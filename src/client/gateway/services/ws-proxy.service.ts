import { ClientRequest, IncomingMessage, ServerResponse, request as httpRequest } from "http";
import { Inject, Injectable, RawBodyRequest } from "@nestjs/common";
import { request as httpsRequest } from "https";
import { Request, Response } from "express";
import { Socket } from "net";
import { URL } from "url";

import { buildInstanceWsUrl, debugError, debugLog, debugWarn, Service } from "../../../common";
import type { ProxyCallbacks, GatewayRoutingConfig, ProxyOptions, ProxyTarget } from "../types";
import { BaseProxyService } from "./base-proxy.service";
import { setupOutgoing, setupSocket } from "../utils";
import { CONNECTION_ERROR_CODES } from "../constants";
import { DiscoveryService } from "../../../discovery";

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
  async proxyRequest(req: RawBodyRequest<Request>, res: Response, routeConfig: GatewayRoutingConfig): Promise<void> {
    this.validateRouteConfig(routeConfig);
    const proxyOptions = this.buildProxyOptions(routeConfig);
    const originalUrl = req.originalUrl || req.url;

    try {
      if (routeConfig.service) {
        await this.proxyToService(originalUrl, req, res, proxyOptions, routeConfig.service);
      } else {
        await this.proxyToTarget(originalUrl, req, res, proxyOptions, routeConfig.target!);
      }
    } catch (error) {
      this.handleError(error as Error, req, res, routeConfig.target);
    }
  }

  private async proxyToService(
    originalUrl: string,
    req: RawBodyRequest<Request>,
    res: Response,
    proxyOptions: ProxyOptions,
    service: string
  ): Promise<void> {
    try {
      await this.discoveryService.discover(service, async (instance: Service, tryAnotherInstance) => {
        const targetUrl = buildInstanceWsUrl(instance);

        debugLog(WsProxyService.name, `Proxying WebSocket request from ${originalUrl} to ${targetUrl}`);

        await this.executeProxy(req, res, { ...proxyOptions, target: targetUrl }, this.handleProxy.bind(this), {
          onConnectFailed: (err) => {
            debugError(WsProxyService.name, `Connection failed to ${targetUrl}: ${err.message}`);
            tryAnotherInstance();
          },
        });
      });
    } catch (error) {
      throw this.handleDiscoveryError(error);
    }
  }

  private async proxyToTarget(
    originalUrl: string,
    req: RawBodyRequest<Request>,
    res: Response,
    proxyOptions: ProxyOptions,
    targetUrl: string
  ): Promise<void> {
    debugLog(WsProxyService.name, `Proxying WebSocket request from ${originalUrl} to ${targetUrl}`);
    await this.executeProxy(req, res, { ...proxyOptions, target: targetUrl }, this.handleProxy.bind(this));
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

      // Notify about connection failure
      if (callbacks.onConnectFailed) {
        callbacks.onConnectFailed(err as Error);
      }

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
    const target = options.target as URL | ProxyTarget;
    const isSSL = target.protocol === "https:" || target.protocol === "wss:";
    const proxyOptions = setupOutgoing({}, options, req);

    setupSocket(socket);
    if (head?.length) socket.unshift(head);

    let proxyReq: ClientRequest;
    try {
      proxyReq = (isSSL ? httpsRequest : httpRequest)(proxyOptions);
    } catch (err) {
      this.handleRequestCreationError(err, socket, callbacks);
      return;
    }

    callbacks.onProxyReqWs?.(proxyReq, req, socket, options, head);

    this.setupProxyRequestHandlers(req, socket, proxyReq, options, callbacks);
    proxyReq.end();
  }

  /**
   * Handles errors that occur during the creation of a WebSocket proxy request.
   * Logs the error, invokes the `onConnectFailed` callback if provided, and closes the socket if it is still open.
   *
   * @param err - The error encountered during request creation.
   * @param socket - The socket associated with the WebSocket connection.
   * @param callbacks - An object containing optional proxy callback functions.
   */
  private handleRequestCreationError(err: Error, socket: Socket, callbacks: ProxyCallbacks): void {
    debugError(WsProxyService.name, `Failed to create WebSocket proxy request: ${err.message}`);
    callbacks.onConnectFailed?.(err);
    if (!socket.destroyed) socket.end();
  }

  /**
   * Sets up event handlers for a proxy WebSocket request, managing error handling,
   * HTTP fallback, WebSocket upgrade, and request timeout.
   *
   * @param req - The incoming HTTP request from the client.
   * @param socket - The network socket associated with the client connection.
   * @param proxyReq - The outgoing proxy request to the target server.
   * @param options - Proxy options including target and timeout settings.
   * @param callbacks - Callback functions for handling connection and error events.
   */
  private setupProxyRequestHandlers(
    req: IncomingMessage,
    socket: Socket,
    proxyReq: ClientRequest,
    options: ProxyOptions,
    callbacks: ProxyCallbacks
  ): void {
    const onOutgoingError = (err: Error) => {
      debugError(WsProxyService.name, `WebSocket proxy error: ${err.message}`);
      if (this.isConnectionError(err)) {
        callbacks.onConnectFailed?.(err);
      } else {
        this.handleError(err, req, socket, options.target, callbacks.onError);
      }
      if (!socket.destroyed) socket.end();
    };

    proxyReq.on("error", onOutgoingError);

    proxyReq.on("response", (proxyRes: IncomingMessage) => {
      if (!proxyRes.headers.upgrade || proxyRes.headers.upgrade.toLowerCase() !== "websocket") {
        debugWarn(WsProxyService.name, "WebSocket upgrade failed, falling back to HTTP");
        socket.write(this.createHttpHeader(`HTTP/${proxyRes.httpVersion} ${proxyRes.statusCode} ${proxyRes.statusMessage || ""}`, proxyRes.headers));
        proxyRes.pipe(socket);
      }
    });

    proxyReq.on("upgrade", (proxyRes: IncomingMessage, proxySocket: Socket, proxyHead: Buffer) => {
      this.handleWebSocketUpgrade(req, socket, proxyRes, proxySocket, proxyHead, options, callbacks);
    });

    if (options.timeout) {
      proxyReq.setTimeout(options.timeout, () => {
        const timeoutError = new Error(`WebSocket proxy timeout after ${options.timeout}ms`);
        proxyReq.destroy(timeoutError);
        callbacks.onConnectFailed?.(timeoutError);
      });
    }
  }

  /**
   * Handles the WebSocket upgrade process between the client and the proxy target.
   *
   * This method sets up the necessary socket piping and event listeners to proxy
   * WebSocket connections, including error handling and lifecycle callbacks.
   *
   * @param req - The incoming HTTP request from the client.
   * @param socket - The socket associated with the client connection.
   * @param proxyRes - The HTTP response from the proxy target.
   * @param proxySocket - The socket connected to the proxy target.
   * @param proxyHead - Any buffered data from the proxy target's upgrade response.
   * @param options - Proxy configuration options.
   * @param callbacks - Callback functions for handling proxy events (open, close, error).
   */
  private handleWebSocketUpgrade(
    req: IncomingMessage,
    socket: Socket,
    proxyRes: IncomingMessage,
    proxySocket: Socket,
    proxyHead: Buffer,
    options: ProxyOptions,
    callbacks: ProxyCallbacks
  ): void {
    debugLog(WsProxyService.name, "WebSocket upgrade successful");

    setupSocket(proxySocket);
    if (proxyHead?.length) proxySocket.unshift(proxyHead);

    socket.write(this.createHttpHeader("HTTP/1.1 101 Switching Protocols", proxyRes.headers));
    proxySocket.pipe(socket).pipe(proxySocket);

    proxySocket.on("error", (err) => {
      debugError(WsProxyService.name, `WebSocket proxy socket error: ${err.message}`);
      this.handleError(err, req, socket, options.target, callbacks.onError);
    });

    const handleClose = () => callbacks.onClose?.(proxyRes, proxySocket, proxyHead);
    proxySocket.on("end", handleClose);
    proxySocket.on("close", handleClose);

    socket.on("error", () => {
      if (!proxySocket.destroyed) proxySocket.end();
    });

    callbacks.onOpen?.(proxySocket);
  }

  /**
   * Creates an HTTP header string from a status line and headers object
   *
   * @param line - The status line
   * @param headers - The headers object
   * @returns Formatted HTTP header string
   */
  private createHttpHeader(line: string, headers: Record<string, string | string[] | undefined>): string {
    const lines = [line];

    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          for (const val of value) {
            lines.push(`${key}: ${val}`);
          }
        } else {
          lines.push(`${key}: ${value}`);
        }
      }
    }

    return lines.join("\r\n") + "\r\n\r\n";
  }
}
