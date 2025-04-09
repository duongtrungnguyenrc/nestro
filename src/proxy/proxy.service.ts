import { IncomingMessage, ServerResponse, request as httpRequest } from "http";
import { Inject, Injectable, RawBodyRequest } from "@nestjs/common";
import { request as httpsRequest } from "https";
import { Request, Response } from "express";
import { Socket } from "net";
import { URL } from "url";

import { ProxyLogger, hasEncryptedConnection, rewriteCookieProperty, setupOutgoing, setupSocket } from "./utils";
import type { ProxyCallbacks, ProxyRouteConfig, ProxyOptions, ProxyTarget } from "./types";
import { buildUrl, debugError, debugLog, debugWarn } from "../common";
import { LoadBalancingService } from "../loadbalancing";

@Injectable()
export class ProxyService {
  constructor(@Inject(LoadBalancingService) private readonly clientLoadBalancingService: LoadBalancingService) {}

  async proxyRequest(req: RawBodyRequest<Request>, res: Response, routeConfig: ProxyRouteConfig) {
    try {
      const originalUrl = req.url;

      return await this.clientLoadBalancingService.executeWithRetry(routeConfig.target, async (instance) => {
        let targetPath: string = originalUrl;

        const targetUrl = buildUrl(instance.host, instance.protocol, instance.port);
        debugLog(ProxyService.name, `Proxying request from ${originalUrl} to ${targetUrl}${targetPath}`);

        let buffer = undefined;

        if (req.rawBody) {
          buffer = req.rawBody;
        } else if (req.body && Object.keys(req.body).length > 0) {
          buffer = JSON.stringify(req.body);
        }

        const proxyOptions: ProxyOptions = {
          target: targetUrl,
          changeOrigin: true,
          xfwd: true,
          pathRewrite: routeConfig.pathRewrite,
          preserveHeaderKeyCase: true,
          buffer: buffer,
          proxyTimeout: routeConfig.timeout,
        };

        this.web(req, res, proxyOptions);

        return new Promise<void>((resolve) => {
          res.on("close", () => {
            resolve();
          });

          res.on("finish", () => {
            resolve();
          });
        });
      });
    } catch (error) {
      debugError(ProxyService.name, `Error in proxyRequest: ${error.message}`);
      if (!res.headersSent) {
        res.status(500).json({ error: "Proxy error", details: error.message });
      }
    }
  }

  /**
   * Proxy an HTTP request
   */
  web(req: IncomingMessage, res: ServerResponse, options: ProxyOptions = {}, callbacks: ProxyCallbacks = {}): void {
    const proxyLogger = new ProxyLogger(options);

    try {
      // Convert string targets to URL objects
      if (typeof options.target === "string") {
        options.target = new URL(options.target);
      }

      // Check for router option (NestJS specific)
      if (options.router) {
        const path = req.url || "/";
        for (const route in options.router) {
          if (new RegExp(route).test(path)) {
            const target = options.router[route];
            options.target = typeof target === "string" ? new URL(target) : target;
            break;
          }
        }
      }

      // Validate options
      if (!options.target) {
        throw new Error("Target is required");
      }

      proxyLogger.debug(`Proxying request to: ${options.target}`);

      // Process the request through middleware passes
      this.processWebRequest(req, res, options, callbacks, proxyLogger);
    } catch (err) {
      proxyLogger.error("Error setting up proxy:", err);
      this.handleError(err as Error, req, res, undefined, callbacks.onError);
    }
  }

  /**
   * Proxy a WebSocket connection
   */
  ws(
    req: IncomingMessage,
    socket: Socket,
    head: Buffer,
    options: ProxyOptions = {},
    callbacks: ProxyCallbacks = {}
  ): void {
    const proxyLogger = new ProxyLogger(options);

    try {
      // Convert string targets to URL objects
      if (typeof options.target === "string") {
        options.target = new URL(options.target);
      }

      // Validate options
      if (!options.target) {
        throw new Error("Target is required");
      }

      proxyLogger.debug(`Proxying WebSocket to: ${options.target}`);

      // Process the WebSocket request
      this.processWsRequest(req, socket, head, options, callbacks, proxyLogger);
    } catch (err) {
      proxyLogger.error("Error setting up WebSocket proxy:", err);
      this.handleError(err as Error, req, socket, undefined, callbacks.onError);
      socket.end();
    }
  }

  /**
   * Process HTTP request through middleware passes
   */
  private processWebRequest(
    req: IncomingMessage,
    res: ServerResponse,
    options: ProxyOptions,
    callbacks: ProxyCallbacks,
    logger: ProxyLogger
  ): void {
    // Set content-length to '0' for DELETE and OPTIONS requests
    if ((req.method === "DELETE" || req.method === "OPTIONS") && !req.headers["content-length"]) {
      req.headers["content-length"] = "0";
      delete req.headers["transfer-encoding"];
    }

    // Set timeout on the request socket
    if (options.timeout) {
      req.socket.setTimeout(options.timeout);
    }

    // Set x-forwarded-* headers
    if (options.xfwd) {
      const encrypted = hasEncryptedConnection(req);
      const values = {
        for: req.socket.remoteAddress || "",
        port: req.socket.remotePort?.toString() || "",
        proto: encrypted ? "https" : "http",
      };

      // Set x-forwarded headers
      for (const header of ["for", "port", "proto"]) {
        const headerName = `x-forwarded-${header}`;
        const currentValue = req.headers[headerName];
        const value = values[header as keyof typeof values];

        req.headers[headerName] = currentValue ? `${currentValue},${value}` : value;
      }

      // Set x-forwarded-host if not already set
      if (!req.headers["x-forwarded-host"]) {
        req.headers["x-forwarded-host"] = req.headers["host"] || "";
      }
    }

    // Stream the request to the target
    this.streamRequest(req, res, options, callbacks);
  }

  /**
   * Stream the request to the target server
   */
  private streamRequest(
    req: IncomingMessage,
    res: ServerResponse,
    options: ProxyOptions,
    callbacks: ProxyCallbacks
  ): void {
    // Call onStart callback
    if (callbacks.onStart) {
      callbacks.onStart(req, res, options.target);
    }

    // Choose HTTP or HTTPS module
    const agents = {
      http: httpRequest,
      https: httpsRequest,
    };

    // Create the proxy request
    const target = options.target as URL | ProxyTarget;
    const targetProtocol = (target as URL).protocol === "https:" ? "https" : "http";

    // Create outgoing options for target request
    const proxyOptions = setupOutgoing({}, options, req);

    const proxyReq = agents[targetProtocol](proxyOptions);

    // Allow developers to modify the proxyReq
    proxyReq.on("socket", (socket) => {
      if (callbacks.onProxyReq) {
        callbacks.onProxyReq(proxyReq, req, res, socket);
      }
    });

    // Set timeout if specified
    if (options.proxyTimeout) {
      proxyReq.setTimeout(options.proxyTimeout, () => {
        proxyReq.destroy();
      });
    }

    // Add explicit timeout handler
    proxyReq.on("timeout", () => {
      debugWarn(ProxyService.name, "Proxy request timeout");
      proxyReq.destroy(new Error("Timeout"));
    });

    // Abort proxy if request is aborted
    req.on("aborted", () => {
      debugLog(ProxyService.name, "Client request aborted");
      proxyReq.destroy();
    });

    // Handle errors
    const proxyError = this.createErrorHandler(proxyReq, options.target, req, res, callbacks.onError);
    req.on("error", proxyError);
    proxyReq.on("error", proxyError);

    // Handle the proxy response
    proxyReq.on("response", (proxyRes: IncomingMessage) => {
      if (callbacks.onProxyRes) {
        callbacks.onProxyRes(proxyRes, req, res);
      }

      // Set status code and headers
      res.statusCode = proxyRes.statusCode || 500;
      if (proxyRes.statusMessage) {
        res.statusMessage = proxyRes.statusMessage;
      }

      // Copy headers from proxy response to client response
      const headers = proxyRes.headers;
      for (const key in headers) {
        if (Object.prototype.hasOwnProperty.call(headers, key)) {
          const header = headers[key];
          if (header !== undefined) {
            try {
              res.setHeader(key, header);
            } catch (err) {
              debugWarn(ProxyService.name, `Error setting header ${key}:` + err);
            }
          }
        }
      }

      // Handle cookie domain rewriting
      if (options.cookieDomainRewrite && res.getHeader("set-cookie")) {
        const cookies = res.getHeader("set-cookie");
        const cookieConfig =
          typeof options.cookieDomainRewrite === "string"
            ? { "*": options.cookieDomainRewrite }
            : options.cookieDomainRewrite;

        const rewrittenCookies = rewriteCookieProperty(cookies as string | string[], cookieConfig, "domain");

        res.setHeader("set-cookie", rewrittenCookies);
      }

      // Handle cookie path rewriting
      if (options.cookiePathRewrite && res.getHeader("set-cookie")) {
        const cookies = res.getHeader("set-cookie");
        const cookieConfig =
          typeof options.cookiePathRewrite === "string"
            ? { "*": options.cookiePathRewrite }
            : options.cookiePathRewrite;

        const rewrittenCookies = rewriteCookieProperty(cookies as string | string[], cookieConfig, "path");

        res.setHeader("set-cookie", rewrittenCookies);
      }

      proxyRes.pipe(res);

      // Call onEnd callback when response ends
      proxyRes.on("end", () => {
        if (callbacks.onEnd) {
          callbacks.onEnd(req, res, proxyRes);
        }
        debugLog(ProxyService.name, "Proxy completed - " + proxyRes.statusCode);
      });

      // Handle errors on the proxy response
      proxyRes.on("error", (err) => {
        console.error("Proxy response error:", err);
        if (!res.headersSent) {
          res.writeHead(502, { "Content-Type": "text/plain" });
          res.end("Proxy Error: " + err.message);
        } else if (!res.finished) {
          res.end();
        }
      });
    });

    // Pipe the request to the proxy
    if (options.buffer) {
      // Nếu có buffer (body đã được đọc), gửi nó
      if (Buffer.isBuffer(options.buffer)) {
        proxyReq.write(options.buffer);
        proxyReq.end();
      } else if (typeof options.buffer === "string") {
        proxyReq.write(options.buffer);
        proxyReq.end();
      } else if (typeof options.buffer === "object") {
        proxyReq.write(JSON.stringify(options.buffer));
        proxyReq.end();
      } else {
        // Nếu buffer là stream, pipe nó
        options.buffer.pipe(proxyReq);
      }
    } else {
      // Pipe request gốc
      req.pipe(proxyReq);
    }
  }

  /**
   * Process WebSocket request
   */
  private processWsRequest(
    req: IncomingMessage,
    socket: Socket,
    head: Buffer,
    options: ProxyOptions,
    callbacks: ProxyCallbacks,
    logger: ProxyLogger
  ): void {
    // Check if the request is a valid WebSocket upgrade request
    if (req.method !== "GET" || !req.headers.upgrade) {
      socket.destroy();
      return;
    }

    const upgrade = req.headers.upgrade;
    if (typeof upgrade === "string" && upgrade.toLowerCase() !== "websocket") {
      socket.destroy();
      return;
    }

    // Set x-forwarded-* headers for WebSocket requests
    if (options.xfwd) {
      const values = {
        for: req.socket.remoteAddress || "",
        port: req.socket.remotePort?.toString() || "",
        proto: hasEncryptedConnection(req) ? "wss" : "ws",
      };

      // Set x-forwarded headers
      for (const header of ["for", "port", "proto"]) {
        const headerName = `x-forwarded-${header}`;
        const currentValue = req.headers[headerName];
        const value = values[header as keyof typeof values];

        req.headers[headerName] = currentValue ? `${currentValue},${value}` : value;
      }
    }

    // Stream the WebSocket connection
    this.streamWebSocket(req, socket, head, options, callbacks, logger);
  }

  /**
   * Stream WebSocket connection to target
   */
  private streamWebSocket(
    req: IncomingMessage,
    socket: Socket,
    head: Buffer,
    options: ProxyOptions,
    callbacks: ProxyCallbacks,
    logger: ProxyLogger
  ): void {
    // Helper function to create HTTP headers
    const createHttpHeader = (line: string, headers: Record<string, string | string[] | undefined>): string => {
      const headerLines = [line];

      for (const key in headers) {
        if (Object.prototype.hasOwnProperty.call(headers, key)) {
          const value = headers[key];

          if (value === undefined) continue;

          if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
              headerLines.push(`${key}: ${value[i]}`);
            }
          } else {
            headerLines.push(`${key}: ${value}`);
          }
        }
      }

      return headerLines.join("\r\n") + "\r\n\r\n";
    };

    // Set up the socket
    setupSocket(socket);

    // Push the head back if it exists
    if (head && head.length) socket.unshift(head);

    // Create the proxy request
    const target = options.target as URL | ProxyTarget;
    const isSSL = (target as URL).protocol === "https:" || (target as URL).protocol === "wss:";

    // Create outgoing options for target request
    const proxyOptions = setupOutgoing({}, options, req);

    logger.debug("WebSocket proxy request options:", proxyOptions);

    const proxyReq = (isSSL ? httpsRequest : httpRequest)(proxyOptions);

    // Allow developers to modify the proxyReq
    if (callbacks.onProxyReqWs) {
      callbacks.onProxyReqWs(proxyReq, req, socket, options, head);
    }

    // Create error handler function
    const onOutgoingError = (err: Error) => {
      console.error("WebSocket proxy error:", err);
      this.handleError(err, req, socket, undefined, callbacks.onError);
      socket.end();
    };

    // Handle errors
    proxyReq.on("error", onOutgoingError);

    // Handle response (non-upgrade)
    proxyReq.on("response", (proxyRes: IncomingMessage) => {
      // If not upgrading, write the response and pipe it to the socket
      if (!proxyRes["upgrade"]) {
        debugWarn(ProxyService.name, "WebSocket upgrade failed, falling back to HTTP");
        const header = createHttpHeader(
          `HTTP/${proxyRes.httpVersion} ${proxyRes.statusCode} ${proxyRes.statusMessage || ""}`,
          proxyRes.headers
        );

        socket.write(header);
        proxyRes.pipe(socket);
      }
    });

    // Handle upgrade event
    proxyReq.on("upgrade", (proxyRes: IncomingMessage, proxySocket: Socket, proxyHead: Buffer) => {
      logger.debug("WebSocket upgrade successful");

      // Handle errors on the proxy socket
      proxySocket.on("error", onOutgoingError);

      // Handle socket close
      proxySocket.on("end", () => {
        if (callbacks.onClose) {
          callbacks.onClose(proxyRes, proxySocket, proxyHead);
        }
      });

      // Handle errors on the client socket
      socket.on("error", () => {
        proxySocket.end();
      });

      // Set up the proxy socket
      setupSocket(proxySocket);

      // Push the head back if it exists
      if (proxyHead && proxyHead.length) proxySocket.unshift(proxyHead);

      // Write the headers to switch protocols
      socket.write(createHttpHeader("HTTP/1.1 101 Switching Protocols", proxyRes.headers));

      // Pipe the sockets together
      proxySocket.pipe(socket).pipe(proxySocket);

      // Call onOpen callback
      if (callbacks.onOpen) {
        callbacks.onOpen(proxySocket);
      }
    });

    // End the request
    proxyReq.end();
  }

  /**
   * Create an error handler for proxy requests
   */
  private createErrorHandler(
    proxyReq: any,
    target: string | URL | ProxyTarget | undefined,
    req: IncomingMessage,
    res: ServerResponse | Socket,
    onError?: (err: Error, req: IncomingMessage, res: ServerResponse | Socket, target?: any) => void
  ): (err: Error) => void {
    return (err: Error): void => {
      // Handle ECONNRESET specially
      if ((req.socket as Socket).destroyed && err.message.includes("ECONNRESET")) {
        debugWarn(ProxyService.name, "Connection reset by peer:", err.message);
        return proxyReq.destroy();
      }

      // Log error
      console.error("Proxy error:", err);

      // Call error handler
      this.handleError(err, req, res, target, onError);
    };
  }

  /**
   * Handle errors
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
    } else {
      // Default error handling
      if (res instanceof ServerResponse && !res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Proxy Error: " + err.message);
      } else if (res instanceof Socket && !res.destroyed) {
        res.end();
      }
    }
  }
}
