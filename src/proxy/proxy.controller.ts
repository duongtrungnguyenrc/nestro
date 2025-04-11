import { Controller, All, Req, Res, Inject, RawBodyRequest } from "@nestjs/common";
import { CanActivate, ExecutionContext } from "@nestjs/common/interfaces";
import { Request, Response } from "express";
import { match } from "path-to-regexp";

import { WEBSOCKET_UPGRADE_HEADER } from "./constants";
import type { ProxyRouteConfig } from "./types";
import { PROXY_ROUTES_CONFIG } from "../client";
import { ProxyService } from "./proxy.service";

/**
 * Controller for handling proxy requests.
 * Routes HTTP and WebSocket requests (including Socket.IO) to appropriate targets based on configuration.
 */
@Controller()
export class ProxyController {
  constructor(
    @Inject(ProxyService) private readonly proxyService: ProxyService,
    @Inject(PROXY_ROUTES_CONFIG) private readonly routesConfig: ProxyRouteConfig[]
  ) {}

  /**
   * Handles all incoming requests (HTTP and WebSocket) and routes them to the proxy service.
   *
   * @param req - The incoming request with raw body.
   * @param res - The outgoing response.
   * @returns A promise resolving when the request is handled, or a response for errors.
   */
  @All("*")
  async handleRequest(@Req() req: RawBodyRequest<Request>, @Res() res: Response): Promise<void> {
    const routeConfig = this.findMatchingRoute(req.url);

    if (!routeConfig) {
      res.status(404).json({ error: "Route not found" });
      return;
    }

    if (routeConfig.guards?.length && !this.checkGuards(routeConfig.guards, req)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (this.isWebSocketRequest(req)) {
      await this.proxyService.proxyWebSocketRequest(req, res, routeConfig);
      return;
    }

    await this.proxyService.proxyHttpRequest(req, res, routeConfig);
  }

  /**
   * Checks if all guards allow the request to proceed.
   *
   * @param guards - Array of guard classes to check.
   * @param request - The incoming request.
   * @returns True if all guards pass, false otherwise.
   */
  private checkGuards(guards: Array<new () => CanActivate>, request: Request): boolean {
    return guards.every((Guard) => {
      const guard = new Guard();
      const context: ExecutionContext = {
        switchToHttp: () => ({ getRequest: () => request }),
      } as ExecutionContext;
      return guard.canActivate(context);
    });
  }

  /**
   * Finds a matching route configuration for the given URL.
   *
   * @param url - The request URL to match.
   * @returns The matching route configuration, or undefined if none found.
   */
  private findMatchingRoute(url: string): ProxyRouteConfig | undefined {
    for (const config of this.routesConfig) {
      const matcher = match(config.route, { decode: decodeURIComponent });
      if (matcher(url)) {
        return config;
      }
    }
    return undefined;
  }

  /**
   * Determines if the request is a WebSocket upgrade request.
   *
   * @param req - The incoming request.
   * @returns True if the request is for WebSocket, false otherwise.
   */
  private isWebSocketRequest(req: Request): boolean {
    return !!req.headers.upgrade && req.headers.upgrade.toLowerCase() === WEBSOCKET_UPGRADE_HEADER;
  }
}
