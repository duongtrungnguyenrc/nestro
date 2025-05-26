import { HttpStatus, Inject, Injectable, RawBodyRequest } from "@nestjs/common";
import { Request, Response } from "express";

import { RouteHandleService } from "./route-handle.service";
import { HttpProxyService } from "./http-proxy.service";
import { WsProxyService } from "./ws-proxy.service";
import { isSocketRequest } from "../utils";
import { ProxyOptions } from "../types";

@Injectable()
export class GatewayService {
  constructor(
    @Inject(HttpProxyService) private readonly httpProxyService: HttpProxyService,
    @Inject(WsProxyService) private readonly wsProxyService: WsProxyService,
    @Inject(RouteHandleService) private readonly routeHandleService: RouteHandleService
  ) {}

  async proxyRequest(req: RawBodyRequest<Request>, res: Response): Promise<void> {
    const routeConfig = this.routeHandleService.findMatchingRoute(req.path);

    if (!routeConfig) {
      res.status(HttpStatus.NOT_FOUND).json({
        message: "Proxy failed because route not found",
        timestamp: new Date().toISOString(),
        statusCode: HttpStatus.NOT_FOUND,
      });

      return;
    }

    const isAllowed = await this.routeHandleService.checkGuards(routeConfig.guards, req, res);

    if (!isAllowed) return;

    if (isSocketRequest(req)) {
      return await this.wsProxyService.proxyRequest(req, res, routeConfig);
    }

    await this.httpProxyService.proxyRequest(req, res, routeConfig);
  }

  executeWithOptions(req: RawBodyRequest<Request>, res: Response, options: ProxyOptions): void {
    if (isSocketRequest(req)) {
      this.wsProxyService.handleProxy(req, res, options);
      return;
    }

    this.httpProxyService.handleProxy(req, res, {
      buffer: this.httpProxyService.getRequestBuffer(req),
      ...options,
    });
  }
}
