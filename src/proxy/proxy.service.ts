import { IncomingMessage, ServerResponse, request as httpRequest } from "http";
import { Inject, Injectable, RawBodyRequest } from "@nestjs/common";
import { request as httpsRequest } from "https";
import { Request, Response } from "express";
import { Socket } from "net";
import { URL } from "url";

import { buildInstanceHttpUrl, buildInstanceWsUrl, debugError, debugLog, debugWarn, ServiceInstance } from "../common";
import { hasEncryptedConnection, rewriteCookieProperty, setupOutgoing, setupSocket } from "./utils";
import type { ProxyCallbacks, ProxyRouteConfig, ProxyOptions, ProxyTarget } from "./types";
import { LoadBalancingService } from "../loadbalancing";

/**
 * Service responsible for proxying HTTP and WebSocket requests, including Socket.IO support.
 * Supports optional service-based load balancing or direct target usage.
 */
@Injectable()
export class ProxyService {
  constructor(@Inject(LoadBalancingService) private readonly loadBalancingService: LoadBalancingService) {}

  /**
   * Proxies an HTTP request to the target server.
   * Uses load balancing if service is provided, otherwise uses direct target.
   *
   * @param req - The incoming HTTP request with raw body.
   * @param res - The outgoing HTTP response.
   * @param routeConfig - Configuration for the proxy route.
   * @returns A promise that resolves when the request is complete.
   */
  async proxyHttpRequest(req: RawBodyRequest<Request>, res: Response, routeConfig: ProxyRouteConfig): Promise<void> {
    try {
      const originalUrl = req.url;

      const proxyOptionsBase: ProxyOptions = {
        changeOrigin: true,
        xfwd: true,
        pathRewrite: routeConfig.pathRewrite,
        preserveHeaderKeyCase: true,
        buffer: this.getRequestBuffer(req),
        proxyTimeout: routeConfig.timeout,
      };

      if (routeConfig.service) {
        // Use load balancing with service
        await this.loadBalancingService.executeWithRetry(routeConfig.service, async (instance: ServiceInstance) => {
          const targetUrl = this.resolveTargetUrl(routeConfig.target, instance, buildInstanceHttpUrl);
          debugLog(ProxyService.name, `Proxying HTTP request from ${originalUrl} to ${targetUrl}`);

          const proxyOptions: ProxyOptions = { ...proxyOptionsBase, target: targetUrl };
          await this.executeProxy(req, res, proxyOptions, this.web.bind(this));
        });
      } else if (routeConfig.target) {
        // Use direct target without load balancing
        const targetUrl = this.resolveDirectTarget(routeConfig.target);
        debugLog(ProxyService.name, `Proxying HTTP request from ${originalUrl} to ${targetUrl}`);

        const proxyOptions: ProxyOptions = { ...proxyOptionsBase, target: targetUrl };
        await this.executeProxy(req, res, proxyOptions, this.web.bind(this));
      } else {
        throw new Error("Either service or target must be provided in routeConfig");
      }
    } catch (error) {
      this.handleHttpError(error as Error, res);
    }
  }

  /**
   * Proxies a WebSocket request to the target server.
   * Uses load balancing if service is provided, otherwise uses direct target.
   *
   * @param req - The incoming HTTP request for WebSocket upgrade.
   * @param res - The outgoing HTTP response.
   * @param routeConfig - Configuration for the proxy route.
   * @returns A promise that resolves when the WebSocket connection is closed.
   */
  async proxyWebSocketRequest(req: Request, res: Response, routeConfig: ProxyRouteConfig): Promise<void> {
    try {
      const originalUrl = req.url;

      const proxyOptionsBase: ProxyOptions = {
        changeOrigin: true,
        xfwd: true,
        pathRewrite: routeConfig.pathRewrite,
      };

      if (routeConfig.service) {
        // Use load balancing with service
        await this.loadBalancingService.executeWithRetry(routeConfig.service, async (instance: ServiceInstance) => {
          const targetUrl = this.resolveTargetUrl(routeConfig.target, instance, buildInstanceWsUrl);
          debugLog(ProxyService.name, `Proxying WebSocket request from ${originalUrl} to ${targetUrl}`);

          const proxyOptions: ProxyOptions = { ...proxyOptionsBase, target: targetUrl };
          await this.executeProxy(req, res, proxyOptions, (r, _, o) => this.ws(r, req.socket, Buffer.from(""), o));
        });
      } else if (routeConfig.target) {
        // Use direct target without load balancing
        const targetUrl = this.resolveDirectTarget(routeConfig.target);
        debugLog(ProxyService.name, `Proxying WebSocket request from ${originalUrl} to ${targetUrl}`);

        const proxyOptions: ProxyOptions = { ...proxyOptionsBase, target: targetUrl };
        await this.executeProxy(req, res, proxyOptions, (r, s, o) => this.ws(r, req.socket, Buffer.from(""), o));
      } else {
        throw new Error("Either service or target must be provided in routeConfig");
      }
    } catch (error) {
      this.handleHttpError(error as Error, res);
    }
  }

  /**
   * Resolves the target URL using a service instance and target configuration.
   *
   * @param target - The target from routeConfig, can be a string or function.
   * @param instance - The service instance from load balancer.
   * @param urlBuildAgent - The function to build URL from instance.
   * @returns The resolved target URL.
   */
  private resolveTargetUrl(
    target: ((instance: ServiceInstance) => string) | string | undefined,
    instance: ServiceInstance,
    urlBuildAgent: (instance: ServiceInstance) => string
  ): string {
    if (typeof target === "function") {
      return target(instance);
    }
    return target || urlBuildAgent(instance);
  }

  /**
   * Resolves the target URL directly from a string or function without instance.
   *
   * @param target - The target from routeConfig, can be a string or function.
   * @returns The resolved target URL.
   */
  private resolveDirectTarget(target: ((instance: ServiceInstance) => string) | string): string {
    if (typeof target === "function") {
      throw new Error("Target as a function requires a service instance, but no service was provided");
    }
    return target;
  }

  /**
   * Extracts the request body buffer if present.
   *
   * @param req - The incoming HTTP request.
   * @returns The buffer or undefined.
   */
  private getRequestBuffer(req: RawBodyRequest<Request>): Buffer | string | undefined {
    if (req.rawBody) {
      return req.rawBody;
    }
    if (req.body && Object.keys(req.body).length > 0) {
      return JSON.stringify(req.body);
    }
    return undefined;
  }

  /**
   * Executes the proxy request and waits for completion.
   *
   * @param req - The incoming request.
   * @param res - The outgoing response.
   * @param options - Proxy options.
   * @param proxyFn - The proxy function to execute (web or ws).
   * @returns A promise that resolves when the proxy is complete.
   */
  private async executeProxy(
    req: RawBodyRequest<Request> | Request,
    res: Response,
    options: ProxyOptions,
    proxyFn: (req: IncomingMessage, res: ServerResponse | Socket, options: ProxyOptions) => void
  ): Promise<void> {
    return new Promise((resolve) => {
      proxyFn(req as IncomingMessage, res as ServerResponse, options);
      res.on("close", resolve).on("finish", resolve);
    });
  }

  /**
   * Proxies an HTTP request to the target server.
   *
   * @param req - The incoming HTTP request.
   * @param res - The outgoing HTTP response.
   * @param options - Proxy configuration options.
   * @param callbacks - Optional callbacks for lifecycle events.
   */
  web(req: IncomingMessage, res: ServerResponse, options: ProxyOptions = {}, callbacks: ProxyCallbacks = {}): void {
    try {
      const normalizedOptions = this.normalizeOptions(options, req.url || "/");
      this.processWebRequest(req, res, normalizedOptions, callbacks);
    } catch (err) {
      this.handleError(err as Error, req, res, undefined, callbacks.onError);
    }
  }

  /**
   * Proxies a WebSocket connection to the target server.
   *
   * @param req - The incoming HTTP request for WebSocket upgrade.
   * @param socket - The client socket.
   * @param head - The first packet of the upgraded stream.
   * @param options - Proxy configuration options.
   * @param callbacks - Optional callbacks for lifecycle events.
   */
  ws(
    req: IncomingMessage,
    socket: Socket,
    head: Buffer,
    options: ProxyOptions = {},
    callbacks: ProxyCallbacks = {}
  ): void {
    try {
      const normalizedOptions = this.normalizeOptions(options, req.url || "/");
      debugLog(ProxyService.name, `Proxying WebSocket to: ${normalizedOptions.target}`);
      this.processWsRequest(req, socket, head, normalizedOptions, callbacks);
    } catch (err) {
      debugError(ProxyService.name, `WebSocket setup error: ${err.message}`);
      this.handleError(err as Error, req, socket, undefined, callbacks.onError);
      socket.end();
    }
  }

  /**
   * Normalizes proxy options by converting string targets to URL objects and applying router logic.
   *
   * @param options - Proxy configuration options.
   * @param path - The request path.
   * @returns Normalized proxy options.
   * @throws Error if target is missing.
   */
  private normalizeOptions(options: ProxyOptions, path: string): ProxyOptions {
    const normalized = { ...options };

    if (typeof normalized.target === "string") {
      normalized.target = new URL(normalized.target);
    }

    if (normalized.router) {
      for (const route in normalized.router) {
        if (new RegExp(route).test(path)) {
          const target = normalized.router[route];
          normalized.target = typeof target === "string" ? new URL(target) : target;
          break;
        }
      }
    }

    if (!normalized.target) {
      throw new Error("Target is required");
    }

    return normalized;
  }

  /**
   * Processes an HTTP request through middleware passes.
   *
   * @param req - The incoming HTTP request.
   * @param res - The outgoing HTTP response.
   * @param options - Normalized proxy options.
   * @param callbacks - Optional callbacks for lifecycle events.
   */
  private processWebRequest(
    req: IncomingMessage,
    res: ServerResponse,
    options: ProxyOptions,
    callbacks: ProxyCallbacks
  ): void {
    if ((req.method === "DELETE" || req.method === "OPTIONS") && !req.headers["content-length"]) {
      req.headers["content-length"] = "0";
      delete req.headers["transfer-encoding"];
    }

    if (options.timeout) {
      req.socket.setTimeout(options.timeout);
    }

    this.addForwardedHeaders(req, options.xfwd);
    this.streamRequest(req, res, options, callbacks);
  }

  /**
   * Streams an HTTP request to the target server.
   *
   * @param req - The incoming HTTP request.
   * @param res - The outgoing HTTP response.
   * @param options - Normalized proxy options.
   * @param callbacks - Optional callbacks for lifecycle events.
   */
  private streamRequest(
    req: IncomingMessage,
    res: ServerResponse,
    options: ProxyOptions,
    callbacks: ProxyCallbacks
  ): void {
    callbacks.onStart?.(req, res, options.target);

    const targetProtocol = (options.target as URL).protocol === "https:" ? "https" : "http";
    const requestAgent = targetProtocol === "https" ? httpsRequest : httpRequest;

    const proxyOptions = setupOutgoing({}, options, req);
    const proxyReq = requestAgent(proxyOptions);

    proxyReq.on("socket", (socket) => callbacks.onProxyReq?.(proxyReq, req, res, socket));

    if (options.proxyTimeout) {
      proxyReq.setTimeout(options.proxyTimeout, () => proxyReq.destroy(new Error("Proxy timeout")));
    }

    req.on("aborted", () => {
      debugLog(ProxyService.name, "Client request aborted");
      proxyReq.destroy();
    });

    const errorHandler = this.createErrorHandler(proxyReq, options.target, req, res, callbacks.onError);
    req.on("error", errorHandler);
    proxyReq.on("error", errorHandler);

    proxyReq.on("response", (proxyRes: IncomingMessage) => {
      callbacks.onProxyRes?.(proxyRes, req, res);

      res.statusCode = proxyRes.statusCode || 500;
      if (proxyRes.statusMessage) {
        res.statusMessage = proxyRes.statusMessage;
      }

      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (value !== undefined) {
          try {
            res.setHeader(key, value);
          } catch (err) {
            debugWarn(ProxyService.name, `Error setting header ${key}: ${err.message}`);
          }
        }
      }

      this.rewriteCookies(res, options);
      proxyRes.pipe(res);

      proxyRes.on("end", () => {
        callbacks.onEnd?.(req, res, proxyRes);
        debugLog(ProxyService.name, `Proxy completed - ${proxyRes.statusCode}`);
      });

      proxyRes.on("error", (err) => {
        debugError(ProxyService.name, `Proxy response error: ${err.message}`);
        if (!res.headersSent) {
          res.writeHead(502, { "Content-Type": "text/plain" });
          res.end(`Proxy Error: ${err.message}`);
        } else if (!res.finished) {
          res.end();
        }
      });
    });

    if (options.buffer) {
      if (Buffer.isBuffer(options.buffer) || typeof options.buffer === "string") {
        proxyReq.write(options.buffer);
        proxyReq.end();
      } else {
        proxyReq.write(JSON.stringify(options.buffer));
        proxyReq.end();
      }
    } else {
      req.pipe(proxyReq);
    }
  }

  /**
   * Processes a WebSocket request by validating and streaming the connection.
   *
   * @param req - The incoming HTTP request.
   * @param socket - The client socket.
   * @param head - The first packet of the upgraded stream.
   * @param options - Normalized proxy options.
   * @param callbacks - Optional callbacks for lifecycle events.
   */
  private processWsRequest(
    req: IncomingMessage,
    socket: Socket,
    head: Buffer,
    options: ProxyOptions,
    callbacks: ProxyCallbacks
  ): void {
    if (req.method !== "GET" || !req.headers.upgrade || req.headers.upgrade.toLowerCase() !== "websocket") {
      socket.destroy();
      return;
    }

    this.addForwardedHeaders(req, options.xfwd, true);
    this.streamWebSocket(req, socket, head, options, callbacks);
  }

  /**
   * Streams a WebSocket connection to the target server.
   *
   * @param req - The incoming HTTP request.
   * @param socket - The client socket.
   * @param head - The first packet of the upgraded stream.
   * @param options - Normalized proxy options.
   * @param callbacks - Optional callbacks for lifecycle events.
   */
  private streamWebSocket(
    req: IncomingMessage,
    socket: Socket,
    head: Buffer,
    options: ProxyOptions,
    callbacks: ProxyCallbacks
  ): void {
    const createHttpHeader = (line: string, headers: Record<string, string | string[] | undefined>): string => {
      const lines = [line];
      for (const [key, value] of Object.entries(headers)) {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach((val) => lines.push(`${key}: ${val}`));
          } else {
            lines.push(`${key}: ${value}`);
          }
        }
      }
      return lines.join("\r\n") + "\r\n\r\n";
    };

    setupSocket(socket);
    if (head && head.length) socket.unshift(head);

    const target = options.target as URL | ProxyTarget;
    const isSSL = target.protocol === "https:" || target.protocol === "wss:";
    const proxyOptions = setupOutgoing({}, options, req);
    const proxyReq = (isSSL ? httpsRequest : httpRequest)(proxyOptions);

    callbacks.onProxyReqWs?.(proxyReq, req, socket, options, head);

    const onOutgoingError = (err: Error) => {
      debugError(ProxyService.name, `WebSocket proxy error: ${err.message}`);
      this.handleError(err, req, socket, undefined, callbacks.onError);
      socket.end();
    };

    proxyReq.on("error", onOutgoingError);

    proxyReq.on("response", (proxyRes: IncomingMessage) => {
      if (!proxyRes.headers.upgrade || proxyRes.headers.upgrade.toLowerCase() !== "websocket") {
        debugWarn(ProxyService.name, "WebSocket upgrade failed, falling back to HTTP");
        socket.write(
          createHttpHeader(
            `HTTP/${proxyRes.httpVersion} ${proxyRes.statusCode} ${proxyRes.statusMessage || ""}`,
            proxyRes.headers
          )
        );
        proxyRes.pipe(socket);
      }
    });

    proxyReq.on("upgrade", (proxyRes: IncomingMessage, proxySocket: Socket, proxyHead: Buffer) => {
      debugLog(ProxyService.name, "WebSocket upgrade successful");

      proxySocket.on("error", onOutgoingError);
      proxySocket.on("end", () => callbacks.onClose?.(proxyRes, proxySocket, proxyHead));

      socket.on("error", () => proxySocket.end());

      setupSocket(proxySocket);
      if (proxyHead && proxyHead.length) proxySocket.unshift(proxyHead);

      socket.write(createHttpHeader("HTTP/1.1 101 Switching Protocols", proxyRes.headers));
      proxySocket.pipe(socket).pipe(proxySocket);

      callbacks.onOpen?.(proxySocket);
    });

    proxyReq.end();
  }

  /**
   * Adds x-forwarded headers to the request.
   *
   * @param req - The incoming HTTP request.
   * @param xfwd - Whether to add x-forwarded headers.
   * @param isWebSocket - Whether the request is for WebSocket.
   */
  private addForwardedHeaders(req: IncomingMessage, xfwd?: boolean, isWebSocket: boolean = false): void {
    if (!xfwd) return;

    const encrypted = hasEncryptedConnection(req);
    const values = {
      for: req.socket.remoteAddress || "",
      port: req.socket.remotePort?.toString() || "",
      proto: isWebSocket ? (encrypted ? "wss" : "ws") : encrypted ? "https" : "http",
    };

    for (const header of ["for", "port", "proto"]) {
      const headerName = `x-forwarded-${header}`;
      const currentValue = req.headers[headerName];
      const value = values[header as keyof typeof values];
      req.headers[headerName] = currentValue ? `${currentValue},${value}` : value;
    }

    if (!req.headers["x-forwarded-host"]) {
      req.headers["x-forwarded-host"] = req.headers["host"] || "";
    }
  }

  /**
   * Rewrites cookies in the response based on configuration.
   *
   * @param res - The outgoing HTTP response.
   * @param options - Proxy configuration options.
   */
  private rewriteCookies(res: ServerResponse, options: ProxyOptions): void {
    const cookies = res.getHeader("set-cookie");
    if (!cookies) return;

    if (options.cookieDomainRewrite) {
      const config =
        typeof options.cookieDomainRewrite === "string"
          ? { "*": options.cookieDomainRewrite }
          : options.cookieDomainRewrite;
      res.setHeader("set-cookie", rewriteCookieProperty(cookies as string | string[], config, "domain"));
    }

    if (options.cookiePathRewrite) {
      const config =
        typeof options.cookiePathRewrite === "string" ? { "*": options.cookiePathRewrite } : options.cookiePathRewrite;
      res.setHeader("set-cookie", rewriteCookieProperty(cookies as string | string[], config, "path"));
    }
  }

  /**
   * Creates an error handler for proxy requests.
   *
   * @param proxyReq - The proxy request object.
   * @param target - The target server.
   * @param req - The incoming HTTP request.
   * @param res - The outgoing response or socket.
   * @param onError - Optional custom error handler.
   * @returns Error handler function.
   */
  private createErrorHandler(
    proxyReq: any,
    target: string | URL | ProxyTarget | undefined,
    req: IncomingMessage,
    res: ServerResponse | Socket,
    onError?: (err: Error, req: IncomingMessage, res: ServerResponse | Socket, target?: any) => void
  ): (err: Error) => void {
    return (err: Error): void => {
      if ((req.socket as Socket).destroyed && err.message.includes("ECONNRESET")) {
        debugWarn(ProxyService.name, `Connection reset by peer: ${err.message}`);
        proxyReq.destroy();
        return;
      }

      debugError(ProxyService.name, `Proxy error: ${err.message}`);
      this.handleError(err, req, res, target, onError);
    };
  }

  /**
   * Handles HTTP errors and sends a response.
   *
   * @param error - The error object.
   * @param res - The outgoing HTTP response.
   */
  private handleHttpError(error: Error, res: Response): void {
    debugError(ProxyService.name, `Proxy error: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: "Proxy error", details: error.message });
    }
  }

  /**
   * Handles proxy errors for HTTP or WebSocket requests.
   *
   * @param err - The error object.
   * @param req - The incoming HTTP request.
   * @param res - The outgoing response or socket.
   * @param target - The target server.
   * @param onError - Optional custom error handler.
   */
  private handleError(
    err: Error,
    req: IncomingMessage,
    res: ServerResponse | Socket,
    target?: any,
    onError?: (err: Error, req: IncomingMessage, res: ServerResponse | Socket, target?: any) => void
  ): void {
    if (onError) {
      onError(err, req, res, target);
    } else if (res instanceof ServerResponse && !res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`Proxy Error: ${err.message}`);
    } else if (res instanceof Socket && !res.destroyed) {
      res.end();
    }
  }
}
