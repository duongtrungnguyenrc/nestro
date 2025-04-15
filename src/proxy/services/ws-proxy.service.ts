import { IncomingMessage, ServerResponse, request as httpRequest } from "http";
import { Inject, Injectable, RawBodyRequest } from "@nestjs/common";
import { request as httpsRequest } from "https";
import { Request, Response } from "express";
import { Socket } from "net";
import { URL } from "url";

import { buildInstanceWsUrl, debugError, debugLog, debugWarn, ServiceInstance } from "../../common";
import type { ProxyCallbacks, ProxyRouteConfig, ProxyOptions, ProxyTarget } from "../types";
import { BaseProxyService } from "./base-proxy.service";
import { setupOutgoing, setupSocket } from "../utils";
import { DiscoveryService } from "../../discovery";

/**
 * Service responsible for proxying HTTP and WebSocket requests, including Socket.IO support.
 * Supports optional service-based load balancing or direct target usage.
 */
@Injectable()
export class WsProxyService extends BaseProxyService {
  constructor(@Inject(DiscoveryService) discoveryService: DiscoveryService) {
    super(discoveryService);
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
  async proxyRequest(req: RawBodyRequest<Request>, res: Response, routeConfig: ProxyRouteConfig): Promise<void> {
    try {
      const originalUrl = req.url;

      const proxyOptionsBase: ProxyOptions = {
        changeOrigin: true,
        xfwd: true,
        pathRewrite: routeConfig.pathRewrite,
      };

      if (routeConfig.service) {
        // Use load balancing with service
        await this.discoveryService.executeWithRetry(routeConfig.service, async (instance: ServiceInstance) => {
          const targetUrl = this.resolveTargetUrl(routeConfig.target, instance, buildInstanceWsUrl);
          debugLog(WsProxyService.name, `Proxying WebSocket request from ${originalUrl} to ${targetUrl}`);

          const proxyOptions: ProxyOptions = { ...proxyOptionsBase, target: targetUrl };
          await this.executeProxy(req, res, proxyOptions, this.handleProxy.bind(this));
        });
      } else if (routeConfig.target) {
        // Use direct target without load balancing
        const targetUrl = this.resolveDirectTarget(routeConfig.target);
        debugLog(WsProxyService.name, `Proxying WebSocket request from ${originalUrl} to ${targetUrl}`);

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
   * Proxies a WebSocket connection to the target server.
   *
   * @param req - The incoming HTTP request for WebSocket upgrade.
   * @param socket - The client socket.
   * @param head - The first packet of the upgraded stream.
   * @param options - Proxy configuration options.
   * @param callbacks - Optional callbacks for lifecycle events.
   */
  handleProxy(req: IncomingMessage, _: ServerResponse, options: ProxyOptions = {}, callbacks: ProxyCallbacks = {}): void {
    const socket = req.socket;
    const head = Buffer.from("");

    try {
      const normalizedOptions = this.normalizeOptions(options, req.url || "/");

      debugLog(WsProxyService.name, `Proxying WebSocket to: ${normalizedOptions.target}`);

      if (req.method !== "GET" || !req.headers.upgrade || req.headers.upgrade.toLowerCase() !== "websocket") {
        socket.destroy();
        return;
      }

      this.addForwardedHeaders(req, normalizedOptions.xfwd, true);
      this.streamRequest(req, socket, head, normalizedOptions, callbacks);
    } catch (err) {
      debugError(WsProxyService.name, `WebSocket setup error: ${err.message}`);
      this.handleError(err as Error, req, socket, undefined, callbacks.onError);
      socket.end();
    }
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
  private streamRequest(req: IncomingMessage, socket: Socket, head: Buffer, options: ProxyOptions, callbacks: ProxyCallbacks): void {
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
      debugError(WsProxyService.name, `WebSocket proxy error: ${err.message}`);
      this.handleError(err, req, socket, undefined, callbacks.onError);
      socket.end();
    };

    proxyReq.on("error", onOutgoingError);

    proxyReq.on("response", (proxyRes: IncomingMessage) => {
      if (!proxyRes.headers.upgrade || proxyRes.headers.upgrade.toLowerCase() !== "websocket") {
        debugWarn(WsProxyService.name, "WebSocket upgrade failed, falling back to HTTP");
        socket.write(createHttpHeader(`HTTP/${proxyRes.httpVersion} ${proxyRes.statusCode} ${proxyRes.statusMessage || ""}`, proxyRes.headers));
        proxyRes.pipe(socket);
      }
    });

    proxyReq.on("upgrade", (proxyRes: IncomingMessage, proxySocket: Socket, proxyHead: Buffer) => {
      debugLog(WsProxyService.name, "WebSocket upgrade successful");

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
}
