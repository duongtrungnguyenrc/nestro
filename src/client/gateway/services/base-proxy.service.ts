import { HttpStatus, Inject, RawBodyRequest } from "@nestjs/common";
import { IncomingMessage, ServerResponse } from "http";
import { Request, Response } from "express";
import { Socket } from "net";
import { URL } from "url";

import type { ProxyCallbacks, ProxyOptions, GatewayRoutingConfig } from "../types";
import { DiscoveryError, DiscoveryService } from "../../../discovery";
import { ProxyError, ProxyErrorType } from "../errors";
import { hasEncryptedConnection } from "../utils";

/**
 * Service responsible for proxying HTTP and WebSocket requests, including Socket.IO support.
 * Supports optional service-based load balancing or direct target usage.
 */
export abstract class BaseProxyService {
  constructor(@Inject(DiscoveryService) protected readonly discoveryService: DiscoveryService) {}

  abstract proxyRequest(req: RawBodyRequest<Request>, res: Response, routeConfig: GatewayRoutingConfig): Promise<void>;

  abstract handleProxy(req: IncomingMessage, res: ServerResponse, options: ProxyOptions, callbacks: ProxyCallbacks): void;

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
    return new Promise((resolve, reject) => {
      let isResolved = false;

      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          reject(new ProxyError(`Proxy timeout after ${options.timeout || 30000}ms`, ProxyErrorType.TIMEOUT, HttpStatus.GATEWAY_TIMEOUT));
        }
      }, options.timeout || 30000);

      const enhancedCallbacks: ProxyCallbacks = {
        ...callbacks,
        onError: (err, req, res, target) => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeout);
            const proxyError = this.categorizeError(err);
            if (callbacks?.onError) {
              callbacks.onError(proxyError, req, res, target);
            } else {
              reject(proxyError);
            }
          }
        },
        onEnd: (req, res, proxyRes) => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeout);
            callbacks?.onEnd?.(req, res, proxyRes);
            resolve();
          }
        },
      };

      try {
        proxyFn(req as IncomingMessage, res as ServerResponse, options, enhancedCallbacks);

        res
          .on("close", () => {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeout);
              resolve();
            }
          })
          .on("finish", () => {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeout);
              resolve();
            }
          });
      } catch (error) {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          reject(this.categorizeError(error));
        }
      }
    });
  }

  /**
   * Validates the provided proxy route configuration to ensure that at least
   * one of `service` or `target` is specified. Throws a `ProxyError` if both
   * are missing, indicating a configuration error.
   *
   * @param routeConfig - The proxy route configuration object to validate.
   * @throws {ProxyError} If neither `service` nor `target` is provided in the configuration.
   */
  protected validateRouteConfig(routeConfig: GatewayRoutingConfig): void {
    if (!routeConfig.service && !routeConfig.target) {
      throw new ProxyError(
        "Either service or target must be provided in routeConfig",
        ProxyErrorType.CONFIGURATION_ERROR,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Builds and returns the proxy options for a given route configuration.
   *
   * @param routeConfig - The configuration object for the proxy route, containing path rewrite rules and timeout settings.
   * @param defaultOptions - Optional partial proxy options to override or extend the default settings.
   * @returns The complete set of proxy options to be used for the proxy middleware.
   */
  protected buildProxyOptions(routeConfig: GatewayRoutingConfig, defaultOptions: Partial<ProxyOptions> = {}): ProxyOptions {
    return {
      changeOrigin: true,
      xfwd: true,
      pathRewrite: routeConfig.pathRewrite,
      preserveHeaderKeyCase: true,
      proxyTimeout: routeConfig.timeout,
      ...defaultOptions,
    };
  }

  /**
   * Handles errors that occur during service discovery and maps them to a standardized `ProxyError`.
   *
   * @param error - The error encountered during discovery.
   * @returns A `ProxyError` instance with an appropriate error type and HTTP status code.
   *          - If the error is a `DiscoveryError`, returns a `ProxyError` with `SERVICE_UNAVAILABLE` status.
   *          - Otherwise, returns a `ProxyError` with `INTERNAL_SERVER_ERROR` status.
   */
  protected handleDiscoveryError(error: Error): ProxyError {
    if (error instanceof DiscoveryError) {
      return new ProxyError(error.message, ProxyErrorType.UNKNOWN, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return new ProxyError(error.message, ProxyErrorType.UNKNOWN, HttpStatus.INTERNAL_SERVER_ERROR);
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
      try {
        normalized.target = new URL(normalized.target);
      } catch {
        throw new ProxyError(`Invalid target URL: ${normalized.target}`, ProxyErrorType.CONFIGURATION_ERROR, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }

    if (normalized.router) {
      for (const route in normalized.router) {
        if (new RegExp(route).test(path)) {
          const target = normalized.router[route];
          try {
            normalized.target = typeof target === "string" ? new URL(target) : target;
          } catch {
            throw new ProxyError(`Invalid router target URL: ${target}`, ProxyErrorType.CONFIGURATION_ERROR, HttpStatus.INTERNAL_SERVER_ERROR);
          }
          break;
        }
      }
    }

    if (!normalized.target) {
      throw new ProxyError("Target is required", ProxyErrorType.CONFIGURATION_ERROR, HttpStatus.INTERNAL_SERVER_ERROR);
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
    const proxyError = this.categorizeError(err);

    console.log(proxyError, err, proxyError.toJson());

    if (onError) {
      onError(err, req, res, target);
    } else if (res instanceof ServerResponse && !res.headersSent) {
      res.writeHead(HttpStatus.SERVICE_UNAVAILABLE, { "Content-Type": "application/json" });

      res.end(proxyError.toJson());
    } else if (res instanceof Socket && !res.destroyed) {
      res.end();
    }
  }

  private categorizeError(error: any): ProxyError {
    if (error instanceof ProxyError) {
      return error;
    }

    if (error.code === "ECONNREFUSED" || error.message.includes("ECONNREFUSED")) {
      return new ProxyError("Connection refused by target server", ProxyErrorType.TARGET_NOT_FOUND, HttpStatus.BAD_GATEWAY);
    }

    if (error.code === "ETIMEDOUT" || error.message.includes("ETIMEDOUT") || error.message.includes("timeout")) {
      return new ProxyError("Timeout occurred while connecting to target server", ProxyErrorType.TIMEOUT, HttpStatus.GATEWAY_TIMEOUT);
    }

    if (error.code === "ENOTFOUND" || error.message.includes("ENOTFOUND")) {
      return new ProxyError("Target host not found", ProxyErrorType.TARGET_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    return new ProxyError(error.message || "Unknown proxy error", ProxyErrorType.UNKNOWN, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
