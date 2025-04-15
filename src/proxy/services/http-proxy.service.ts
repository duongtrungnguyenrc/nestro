import { IncomingMessage, ServerResponse, request as httpRequest } from "http";
import { Inject, Injectable, RawBodyRequest } from "@nestjs/common";
import { request as httpsRequest } from "https";
import { Request, Response } from "express";
import { Socket } from "net";
import { URL } from "url";

import { buildInstanceHttpUrl, debugError, debugLog, debugWarn, ServiceInstance } from "../../common";
import type { ProxyCallbacks, ProxyRouteConfig, ProxyOptions, ProxyTarget } from "../types";
import { rewriteCookieProperty, setupOutgoing } from "../utils";
import { BaseProxyService } from "./base-proxy.service";
import { DiscoveryService } from "../../discovery";

/**
 * Service responsible for proxying HTTP and WebSocket requests, including Socket.IO support.
 * Supports optional service-based load balancing or direct target usage.
 */
@Injectable()
export class HttpProxyService extends BaseProxyService {
  constructor(@Inject(DiscoveryService) discoveryService: DiscoveryService) {
    super(discoveryService);
  }

  /**
   * Proxies an HTTP request to the target server.
   * Uses load balancing if service is provided, otherwise uses direct target.
   *
   * @param req - The incoming HTTP request with raw body.
   * @param res - The outgoing HTTP response.
   * @param routeConfig - Configuration for the proxy route.
   * @returns A promise that resolves when the request is complete.
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
        // Use load balancing with service
        await this.discoveryService.executeWithRetry(routeConfig.service, async (instance: ServiceInstance) => {
          const targetUrl = this.resolveTargetUrl(routeConfig.target, instance, buildInstanceHttpUrl);
          debugLog(HttpProxyService.name, `Proxying HTTP request from ${originalUrl} to ${targetUrl}`);

          const proxyOptions: ProxyOptions = { ...proxyOptionsBase, target: targetUrl };
          await this.executeProxy(req, res, proxyOptions, this.handleProxy.bind(this));
        });
      } else if (routeConfig.target) {
        // Use direct target without load balancing
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
   * Proxies an HTTP request to the target server.
   *
   * @param req - The incoming HTTP request.
   * @param res - The outgoing HTTP response.
   * @param options - Proxy configuration options.
   * @param callbacks - Optional callbacks for lifecycle events.
   */
  handleProxy(req: IncomingMessage, res: ServerResponse, options: ProxyOptions = {}, callbacks: ProxyCallbacks = {}): void {
    try {
      const normalizedOptions = this.normalizeOptions(options, req.url || "/");

      if ((req.method === "DELETE" || req.method === "OPTIONS") && !req.headers["content-length"]) {
        req.headers["content-length"] = "0";
        delete req.headers["transfer-encoding"];
      }

      if (normalizedOptions.timeout) {
        req.socket.setTimeout(normalizedOptions.timeout);
      }

      this.addForwardedHeaders(req, normalizedOptions.xfwd);
      this.streamRequest(req, res, normalizedOptions, callbacks);
    } catch (err) {
      this.handleError(err as Error, req, res, undefined, callbacks.onError);
    }
  }

  /**
   * Streams an HTTP request to the target server.
   *
   * @param req - The incoming HTTP request.
   * @param res - The outgoing HTTP response.
   * @param options - Normalized proxy options.
   * @param callbacks - Optional callbacks for lifecycle events.
   */
  private streamRequest(req: IncomingMessage, res: ServerResponse, options: ProxyOptions, callbacks: ProxyCallbacks): void {
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
      debugLog(HttpProxyService.name, "Client request aborted");
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
            debugWarn(HttpProxyService.name, `Error setting header ${key}: ${err.message}`);
          }
        }
      }

      this.rewriteCookies(res, options);
      proxyRes.pipe(res);

      proxyRes.on("end", () => {
        callbacks.onEnd?.(req, res, proxyRes);
        debugLog(HttpProxyService.name, `Proxy completed - ${proxyRes.statusCode}`);
      });

      proxyRes.on("error", (err) => {
        debugError(HttpProxyService.name, `Proxy response error: ${err.message}`);
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
   * Extracts the request body buffer if present.
   *
   * @param req - The incoming HTTP request.
   * @returns The buffer or undefined.
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
   * Rewrites cookies in the response based on configuration.
   *
   * @param res - The outgoing HTTP response.
   * @param options - Proxy configuration options.
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
    onError?: (err: Error, req: IncomingMessage, res: ServerResponse | Socket, target?: any) => void,
  ): (err: Error) => void {
    return (err: Error): void => {
      if (req.socket.destroyed && err.message.includes("ECONNRESET")) {
        debugWarn(HttpProxyService.name, `Connection reset by peer: ${err.message}`);
        proxyReq.destroy();
        return;
      }

      debugError(HttpProxyService.name, `Proxy error: ${err}`);
      this.handleError(err, req, res, target, onError);
    };
  }
}
