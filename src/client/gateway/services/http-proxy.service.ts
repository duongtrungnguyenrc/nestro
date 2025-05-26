import { ClientRequest, IncomingMessage, ServerResponse, request as httpRequest } from "http";
import { Inject, Injectable, RawBodyRequest } from "@nestjs/common";
import { request as httpsRequest } from "https";
import { Request, Response } from "express";
import { URL } from "url";

import type { ProxyCallbacks, GatewayRoutingConfig, ProxyOptions, OutgoingOptions } from "../types";
import { buildInstanceHttpUrl, debugError, debugLog, debugWarn, Service } from "../../../common";
import { rewriteCookieProperty, setupOutgoing } from "../utils";
import { BaseProxyService } from "./base-proxy.service";
import { CONNECTION_ERROR_CODES } from "../constants";
import { DiscoveryService } from "../../../discovery";

/**
 * Service responsible for proxying HTTP and WebSocket requests.
 * Supports service-based load balancing or direct target URL.
 */
@Injectable()
export class HttpProxyService extends BaseProxyService {
  constructor(@Inject(DiscoveryService) discoveryService: DiscoveryService) {
    super(discoveryService);
  }

  /**
   * Proxies an HTTP request to a target server.
   * Uses service discovery and load balancing if a service is specified,
   * or directly proxies to a specific target URL.
   *
   * @param req - Incoming request with raw body.
   * @param res - Express response object.
   * @param routeConfig - Configuration for the route to determine target or service.
   */
  async proxyRequest(req: RawBodyRequest<Request>, res: Response, routeConfig: GatewayRoutingConfig): Promise<void> {
    this.validateRouteConfig(routeConfig);
    const proxyOptions = this.buildProxyOptions(routeConfig, {
      buffer: this.getRequestBuffer(req),
    });
    const originalUrl = req.originalUrl || req.url;

    try {
      if (routeConfig.service) {
        await this.proxyToService(originalUrl, req, res, proxyOptions, routeConfig.service);
      } else {
        await this.proxyToTarget(originalUrl, req, res, proxyOptions, routeConfig.target);
      }
    } catch (error) {
      this.handleError(error, req, res, routeConfig.target);
    }
  }

  /**
   * Proxies an incoming HTTP request to a discovered service instance.
   *
   * This method uses the discovery service to find an available instance of the specified service,
   * then forwards the HTTP request to that instance using the provided proxy options.
   * If the connection to an instance fails, it will attempt to try another available instance.
   * Handles errors related to service discovery and proxying.
   *
   * @param originalUrl - The original URL of the incoming request.
   * @param req - The incoming HTTP request object, possibly containing the raw body.
   * @param res - The HTTP response object to send the proxied response.
   * @param proxyOptions - Options to configure the proxy behavior.
   * @param service - The name of the service to which the request should be proxied.
   * @returns A promise that resolves when the proxying operation is complete.
   * @throws Throws an error if service discovery fails or if proxying cannot be completed.
   */
  private async proxyToService(
    originalUrl: string,
    req: RawBodyRequest<Request>,
    res: Response,
    proxyOptions: ProxyOptions,
    service: string
  ): Promise<void> {
    try {
      await this.discoveryService.discover(service, async (instance: Service, tryAnotherInstance) => {
        const targetUrl = buildInstanceHttpUrl(instance);
        debugLog(HttpProxyService.name, `Proxying HTTP request from ${originalUrl} to ${targetUrl}`);

        await this.executeProxy(req, res, { ...proxyOptions, target: targetUrl }, this.handleProxy.bind(this), {
          onConnectFailed: (err) => {
            debugError(HttpProxyService.name, `Connection failed to ${targetUrl}: ${err.message}`);
            tryAnotherInstance();
          },
        });
      });
    } catch (error) {
      throw this.handleDiscoveryError(error);
    }
  }

  /**
   * Proxies an incoming HTTP request to the specified target URL using the provided proxy options.
   *
   * @param originalUrl - The original URL of the incoming request.
   * @param req - The incoming HTTP request object, potentially containing the raw body.
   * @param res - The HTTP response object to send the proxied response.
   * @param proxyOptions - Configuration options for the proxy operation.
   * @param targetUrl - The destination URL or URL object to which the request should be proxied.
   * @returns A promise that resolves when the proxy operation is complete.
   */
  private async proxyToTarget(
    originalUrl: string,
    req: RawBodyRequest<Request>,
    res: Response,
    proxyOptions: ProxyOptions,
    targetUrl: string | URL
  ): Promise<void> {
    debugLog(HttpProxyService.name, `Proxying HTTP request from ${originalUrl} to ${targetUrl}`);
    await this.executeProxy(req, res, { ...proxyOptions, target: targetUrl }, this.handleProxy.bind(this));
  }

  /**
   * Internal handler for setting up and streaming a proxy request.
   *
   * @param req - Incoming request.
   * @param res - Outgoing response.
   * @param options - Proxy configuration.
   * @param callbacks - Optional lifecycle event callbacks.
   */
  handleProxy(req: IncomingMessage, res: ServerResponse, options: ProxyOptions = {}, callbacks: ProxyCallbacks = {}): void {
    const normalizedOptions = this.normalizeOptions(options, req.url || "/");

    // Set content-length if missing for DELETE/OPTIONS
    if ((req.method === "DELETE" || req.method === "OPTIONS") && !req.headers["content-length"]) {
      req.headers["content-length"] = "0";
      delete req.headers["transfer-encoding"];
    }

    // Set socket timeout if provided
    if (normalizedOptions.timeout) {
      req.socket.setTimeout(normalizedOptions.timeout);
    }

    this.addForwardedHeaders(req, normalizedOptions.xfwd);
    this.streamRequest(req, res, normalizedOptions, callbacks);
  }

  /**
   * Streams the HTTP request to the actual target using http/https modules.
   *
   * @param req - Incoming request.
   * @param res - Outgoing response.
   * @param options - Normalized proxy options.
   * @param callbacks - Optional lifecycle callbacks.
   */
  private streamRequest(req: IncomingMessage, res: ServerResponse, options: ProxyOptions, callbacks: ProxyCallbacks): void {
    callbacks.onStart?.(req, res, options.target);

    const targetProtocol = (options.target as URL).protocol === "https:" ? httpsRequest : httpRequest;

    const proxyOptions: OutgoingOptions = setupOutgoing({}, options, req);
    const proxyReq = targetProtocol(proxyOptions);

    this.handleProxyRequest(req, res, proxyReq, options, callbacks);
    this.sendRequest(req, proxyReq, options.buffer);
  }

  /**
   * Extracts the raw request buffer for proxying.
   *
   * @param req - Incoming request.
   * @returns Buffer, string, or undefined.
   */
  getRequestBuffer(req: RawBodyRequest<Request>): Buffer | string | undefined {
    if (req.rawBody) return req.rawBody;

    if (req.body && Object.keys(req.body).length > 0) {
      return JSON.stringify(req.body);
    }

    return undefined;
  }

  /**
   * Handles the lifecycle and events of a proxied HTTP request.
   *
   * Sets up event listeners on the proxy request and the original client request to manage errors,
   * timeouts, socket events, and responses. Invokes appropriate callbacks for connection failures,
   * proxy request events, and errors. Forwards the proxy response to the client.
   *
   * @param req - The incoming client HTTP request.
   * @param res - The server response object to send data back to the client.
   * @param proxyReq - The outgoing proxy HTTP request.
   * @param options - Proxy configuration options.
   * @param callbacks - Callback functions for handling proxy events.
   */
  private handleProxyRequest(
    req: IncomingMessage,
    res: ServerResponse,
    proxyReq: ClientRequest,
    options: ProxyOptions,
    callbacks: ProxyCallbacks
  ): void {
    proxyReq.on("error", (err) => {
      if (this.isConnectionError(err)) {
        callbacks.onConnectFailed?.(err);
      }
      this.handleError(err, req, res, options.target, callbacks.onError);
    });

    proxyReq.on("socket", (socket) => {
      callbacks.onProxyReq?.(proxyReq, req, res, socket);
    });

    if (options.proxyTimeout) {
      proxyReq.setTimeout(options.proxyTimeout, () => {
        const timeoutError = new Error("Proxy timeout");
        proxyReq.destroy(timeoutError);
        callbacks.onConnectFailed?.(timeoutError);
      });
    }

    req.on("aborted", () => {
      debugError(HttpProxyService.name, "Client request aborted");
      proxyReq.destroy();
    });

    req.on("error", (err) => {
      debugError(HttpProxyService.name, `Client request error: ${err.message}`);
      proxyReq.destroy();
      this.handleError(err, req, res, options.target, callbacks.onError);
    });

    proxyReq.on("response", (proxyRes: IncomingMessage) => {
      this.handleProxyResponse(req, res, proxyRes, options, callbacks);
    });
  }

  /**
   * Handles the response from the proxied server and pipes it to the client response.
   *
   * This method sets the status code and status message on the client response,
   * copies headers from the proxy response, rewrites cookies as necessary, and
   * streams the proxy response body to the client. It also invokes the appropriate
   * callbacks for proxy response and completion events, and handles errors that
   * may occur during the proxying process.
   *
   * @param req - The original incoming HTTP request from the client.
   * @param res - The HTTP response object to send data back to the client.
   * @param proxyRes - The HTTP response received from the proxied target server.
   * @param options - Proxy options containing configuration such as the target server.
   * @param callbacks - Callback functions for handling proxy events such as response, end, and error.
   */
  private handleProxyResponse(
    req: IncomingMessage,
    res: ServerResponse,
    proxyRes: IncomingMessage,
    options: ProxyOptions,
    callbacks: ProxyCallbacks
  ): void {
    callbacks.onProxyRes?.(proxyRes, req, res);

    res.statusCode = proxyRes.statusCode || 500;
    if (proxyRes.statusMessage) {
      res.statusMessage = proxyRes.statusMessage;
    }

    this.copyHeaders(proxyRes, res);
    this.rewriteCookies(res, options);
    proxyRes.pipe(res);

    proxyRes.on("end", () => {
      callbacks.onEnd?.(req, res, proxyRes);
      debugLog(HttpProxyService.name, `Proxy completed - ${proxyRes.statusCode}`);
    });

    proxyRes.on("error", (err) => {
      if (!res.headersSent) {
        this.handleError(new Error(`Proxy response error: ${err.message}`), req, res, options.target, callbacks.onError);
      } else if (!res.finished) {
        res.end();
      }
    });
  }

  /**
   * Sends the request body to the proxy
   *
   * @param req - Client request
   * @param proxyReq - Proxy request
   * @param buffer - Optional buffer to send
   */
  private sendRequest(req: IncomingMessage, proxyReq: ClientRequest, buffer?: Buffer | string | object): void {
    if (buffer) {
      const data = Buffer.isBuffer(buffer) || typeof buffer === "string" ? buffer : JSON.stringify(buffer);
      proxyReq.write(data);
      proxyReq.end();
    } else {
      req.pipe(proxyReq);
    }
  }

  /**
   * Checks if an error is related to connection issues
   *
   * @param err - The error to check
   * @returns boolean indicating if this is a connection error
   */
  private isConnectionError(err: Error): boolean {
    return (
      CONNECTION_ERROR_CODES.some((code) => err.message.includes(code) || (err as any).code === code) ||
      /connect|connection|timeout/i.test(err.message)
    );
  }

  /**
   * Copies headers from proxy response to client response
   *
   * @param proxyRes - Proxy response
   * @param res - Client response
   */
  private copyHeaders(proxyRes: IncomingMessage, res: ServerResponse): void {
    const skipHeaders = ["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailers", "transfer-encoding", "upgrade"];

    for (const [key, value] of Object.entries(proxyRes.headers)) {
      if (value !== undefined && !skipHeaders.includes(key.toLowerCase())) {
        try {
          res.setHeader(key, value);
        } catch (err) {
          debugWarn(HttpProxyService.name, `Error setting header ${key}: ${err.message}`);
        }
      }
    }
  }

  /**
   * Optionally rewrites cookie domain and path in the response.
   *
   * @param res - Outgoing response.
   * @param options - Proxy configuration.
   */

  private rewriteCookies(res: ServerResponse, options: ProxyOptions): void {
    const cookies = res.getHeader("set-cookie");
    if (!cookies) return;

    const rewrite = (config: string | Record<string, string>, property: "domain" | "path") => {
      const rewriteConfig = typeof config === "string" ? { "*": config } : config;
      res.setHeader("set-cookie", rewriteCookieProperty(cookies as string | string[], rewriteConfig, property));
    };

    if (options.cookieDomainRewrite) rewrite(options.cookieDomainRewrite, "domain");
    if (options.cookiePathRewrite) rewrite(options.cookiePathRewrite, "path");
  }
}
