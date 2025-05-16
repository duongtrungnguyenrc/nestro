import { IncomingMessage, ServerResponse } from "http";
import { Inject, RawBodyRequest } from "@nestjs/common";
import { Request, Response } from "express";
import { Socket } from "net";
import { URL } from "url";

import type { ProxyCallbacks, ProxyOptions, ProxyRouteConfig } from "../types";
import { DiscoveryService } from "../../discovery";
import { hasEncryptedConnection } from "../utils";
import { Service } from "../../common";

/**
 * Service responsible for proxying HTTP and WebSocket requests, including Socket.IO support.
 * Supports optional service-based load balancing or direct target usage.
 */
export abstract class BaseProxyService {
  constructor(@Inject(DiscoveryService) protected readonly discoveryService: DiscoveryService) {}

  abstract proxyRequest(req: RawBodyRequest<Request>, res: Response, routeConfig: ProxyRouteConfig): Promise<void>;

  abstract handleProxy(req: IncomingMessage, res: ServerResponse, options: ProxyOptions, callbacks: ProxyCallbacks): void;

  /**
   * Resolves the target URL using a service instance and target configuration.
   *
   * @param target - The target from routeConfig, can be a string or function.
   * @param instance - The service instance from load balancer.
   * @param urlBuildAgent - The function to build URL from instance.
   * @returns The resolved target URL.
   */
  protected resolveTargetUrl(
    target: ((instance: Service) => string) | string | undefined,
    instance: Service,
    urlBuildAgent: (instance: Service) => string
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
  protected resolveDirectTarget(target: ((instance: Service) => string) | string): string {
    if (typeof target === "function") {
      throw new Error("Target as a function requires a service instance, but no service was provided");
    }
    return target;
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
  protected async executeProxy(
    req: RawBodyRequest<Request> | Request,
    res: Response,
    options: ProxyOptions,
    proxyFn: (req: IncomingMessage, res: ServerResponse | Socket, options: ProxyOptions, callbacks?: ProxyCallbacks) => void,
    callbacks?: ProxyCallbacks
  ): Promise<void> {
    return new Promise((resolve) => {
      proxyFn(req as IncomingMessage, res as ServerResponse, options, callbacks);
      res.on("close", resolve).on("finish", resolve);
    });
  }

  /**
   * Adds x-forwarded headers to the request.
   *
   * @param req - The incoming HTTP request.
   * @param xfwd - Whether to add x-forwarded headers.
   * @param isWebSocket - Whether the request is for WebSocket.
   */
  addForwardedHeaders(req: IncomingMessage, xfwd?: boolean, isWebSocket: boolean = false): void {
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
   * Normalizes proxy options by converting string targets to URL objects and applying router logic.
   *
   * @param options - Proxy configuration options.
   * @param path - The request path.
   * @returns Normalized proxy options.
   * @throws Error if target is missing.
   */
  protected normalizeOptions(options: ProxyOptions, path: string): ProxyOptions {
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
   * Handles proxy errors for HTTP or WebSocket requests.
   *
   * @param err - The error object.
   * @param req - The incoming HTTP request.
   * @param res - The outgoing response or socket.
   * @param target - The target server.
   * @param onError - Optional custom error handler.
   */
  protected handleError(
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
      res.end(`Proxy Error: ${err}`);
    } else if (res instanceof Socket && !res.destroyed) {
      res.end();
    }
  }
}
