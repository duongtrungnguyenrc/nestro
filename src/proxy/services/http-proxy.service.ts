import { HttpStatus, Inject, Injectable, RawBodyRequest, ServiceUnavailableException } from "@nestjs/common";
import { ClientRequest, IncomingMessage, ServerResponse, request as httpRequest } from "http";
import { request as httpsRequest } from "https";
import { Request, Response } from "express";
import { URL } from "url";

import { buildInstanceHttpUrl, debugError, debugLog, debugWarn, Service } from "../../common";
import type { ProxyCallbacks, ProxyRouteConfig, ProxyOptions, OutgoingOptions } from "../types";
import { rewriteCookieProperty, setupOutgoing } from "../utils";
import { BaseProxyService } from "./base-proxy.service";
import { DiscoveryService } from "../../discovery";
import { CONNECTION_ERROR_CODES } from "../constants";

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
  async proxyRequest(req: RawBodyRequest<Request>, res: Response, routeConfig: ProxyRouteConfig): Promise<void> {
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
        // Load-balanced proxying using service discovery
        await this.discoveryService.discover(routeConfig.service, async (instance: Service, tryAnotherInstance) => {
          const targetUrl = this.resolveTargetUrl(routeConfig.target, instance, buildInstanceHttpUrl);

          debugLog(HttpProxyService.name, `Proxying HTTP request from ${originalUrl} to ${targetUrl}`);

          const proxyOptions: ProxyOptions = { ...proxyOptionsBase, target: targetUrl };

          await this.executeProxy(req, res, proxyOptions, this.handleProxy.bind(this), {
            onConnectFailed: (err) => {
              debugError(HttpProxyService.name, `Connection failed to ${targetUrl}: ${err.message}`);
              tryAnotherInstance();
            },
          });
        });
      } else if (routeConfig.target) {
        // Direct proxy to a static target
        const targetUrl = this.resolveDirectTarget(routeConfig.target);
        debugLog(HttpProxyService.name, `Proxying HTTP request from ${originalUrl} to ${targetUrl}`);

        const proxyOptions: ProxyOptions = { ...proxyOptionsBase, target: targetUrl };
        await this.executeProxy(req, res, proxyOptions, this.handleProxy.bind(this));
      } else {
        throw new Error("Either service or target must be provided in routeConfig");
      }
    } catch (error) {
      this.handleError(error as Error, req, res, routeConfig.target);
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

    const targetProtocol = (options.target as URL).protocol === "https:" ? "https" : "http";
    const requestAgent = targetProtocol === "https" ? httpsRequest : httpRequest;

    const proxyOptions: OutgoingOptions = setupOutgoing({}, options, req);

    const proxyReq: ClientRequest = requestAgent(proxyOptions);

    // Set up error handling early to catch connection errors
    proxyReq.on("error", (err) => {
      if (this.isConnectionError(err)) {
        callbacks.onConnectFailed?.(err);
      }

      this.handleError(err, req, res, options.target, callbacks.onError);
    });

    // Optional callback for socket event
    proxyReq.on("socket", (socket) => {
      callbacks.onProxyReq?.(proxyReq, req, res, socket);
    });

    // Set proxy timeout if specified
    if (options.proxyTimeout) {
      proxyReq.setTimeout(options.proxyTimeout, () => {
        const timeoutError = new Error("Proxy timeout");
        proxyReq.destroy(timeoutError);
        callbacks.onConnectFailed?.(timeoutError);
      });
    }

    // Abort handling
    req.on("aborted", () => {
      debugError(HttpProxyService.name, "Client request aborted");
      proxyReq.destroy();
    });

    // Error handling for the incoming request
    req.on("error", (err) => {
      debugError(HttpProxyService.name, `Client request error: ${err.message}`);
      proxyReq.destroy();
      this.handleError(err, req, res, options.target, callbacks.onError);
    });

    // Response event
    proxyReq.on("response", (proxyRes: IncomingMessage) => {
      callbacks.onProxyRes?.(proxyRes, req, res);

      // Set status code and message
      res.statusCode = proxyRes.statusCode || 500;
      if (proxyRes.statusMessage) {
        res.statusMessage = proxyRes.statusMessage;
      }

      // Copy headers efficiently
      this.copyHeaders(proxyRes, res);

      // Rewrite cookie domain/path if configured
      this.rewriteCookies(res, options);

      // Pipe the response
      proxyRes.pipe(res);

      // Handle response events
      proxyRes.on("end", () => {
        callbacks.onEnd?.(req, res, proxyRes);
        debugLog(HttpProxyService.name, `Proxy completed - ${proxyRes.statusCode}`);
      });

      proxyRes.on("error", (err) => {
        debugError(HttpProxyService.name, `Proxy response error: ${err.message}`);
        if (!res.headersSent) {
          res.writeHead(HttpStatus.SERVICE_UNAVAILABLE, { "Content-Type": "text/plain" });
          res.end(new ServiceUnavailableException(err.message).message);
        } else if (!res.finished) {
          res.end();
        }
      });
    });

    // Send buffer or stream request
    this.sendRequest(req, proxyReq, options.buffer);
  }

  /**
   * Copies headers from proxy response to client response
   *
   * @param proxyRes - Proxy response
   * @param res - Client response
   */
  private copyHeaders(proxyRes: IncomingMessage, res: ServerResponse): void {
    Object.entries(proxyRes.headers).forEach(([key, value]) => {
      if (value !== undefined) {
        try {
          res.setHeader(key, value);
        } catch (err) {
          debugWarn(HttpProxyService.name, `Error setting header ${key}: ${err.message}`);
        }
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
      if (Buffer.isBuffer(buffer) || typeof buffer === "string") {
        proxyReq.write(buffer);
      } else {
        proxyReq.write(JSON.stringify(buffer));
      }
      proxyReq.end();
    } else {
      req.pipe(proxyReq);
    }
  }

  /**
   * Extracts the raw request buffer for proxying.
   *
   * @param req - Incoming request.
   * @returns Buffer, string, or undefined.
   */
  getRequestBuffer(req: RawBodyRequest<Request>): Buffer | string | undefined {
    if (req.rawBody) {
      return req.rawBody;
    }
    if (req.body && Object.keys(req.body).length > 0) {
      return JSON.stringify(req.body);
    }
    return undefined;
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

    if (options.cookieDomainRewrite) {
      const config = typeof options.cookieDomainRewrite === "string" ? { "*": options.cookieDomainRewrite } : options.cookieDomainRewrite;
      res.setHeader("set-cookie", rewriteCookieProperty(cookies as string | string[], config, "domain"));
    }

    if (options.cookiePathRewrite) {
      const config = typeof options.cookiePathRewrite === "string" ? { "*": options.cookiePathRewrite } : options.cookiePathRewrite;
      res.setHeader("set-cookie", rewriteCookieProperty(cookies as string | string[], config, "path"));
    }
  }
}
