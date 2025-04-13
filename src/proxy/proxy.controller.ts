import { Controller, All, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";

import { HttpProxyService, RouteHandleService, WsProxyService } from "./services";

/**
 * Controller for handling proxy requests.
 * Routes HTTP and WebSocket requests (including Socket.IO) to appropriate targets based on configuration.
 */
@Controller()
export class ProxyController {
  constructor(
    private readonly httpProxyService: HttpProxyService,
    private readonly wsProxyService: WsProxyService,
    private readonly routeHandleService: RouteHandleService
  ) {}

  /**
   * Handles all incoming requests (HTTP and WebSocket) and routes them to the proxy service.
   *
   * @param req - The incoming request with raw body.
   * @param res - The outgoing response.
   * @returns A promise resolving when the request is handled, or a response for errors.
   */
  @All("*")
  async handleRequest(@Req() req: Request, @Res() res: Response): Promise<void> {
    const routeConfig = this.routeHandleService.findMatchingRoute(req.url);

    if (!routeConfig) {
      res.status(404).json({ error: "Route not found" });
      return;
    }

    if (routeConfig.requestHooks?.guards) {
      const isAllowed = await this.routeHandleService.checkGuards(routeConfig.requestHooks.guards, req, res);

      if (!isAllowed) return;
    }

    if (this.routeHandleService.isWebSocketRequest(req)) {
      await this.wsProxyService.proxyRequest(req, res, routeConfig);
      return;
    }

    await this.httpProxyService.proxyRequest(req, res, routeConfig);
  }
}
