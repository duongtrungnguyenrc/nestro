import { Inject, Injectable, RawBodyRequest } from "@nestjs/common";
import { Request, Response } from "express";

import { RouteHandleService } from "./route-handle.service";
import { HttpProxyService } from "./http-proxy.service";
import { WsProxyService } from "./ws-proxy.service";
import { isSocketRequest } from "../utils";
import { ProxyOptions } from "../types";

@Injectable()
export class ProxyService {
  constructor(
    @Inject(HttpProxyService) private readonly httpProxyService: HttpProxyService,
    @Inject(WsProxyService) private readonly wsProxyService: WsProxyService,
    @Inject(RouteHandleService) private readonly routeHandleService: RouteHandleService
  ) {}

  async execute(req: RawBodyRequest<Request>, res: Response): Promise<void> {
    const routeConfig = this.routeHandleService.findMatchingRoute(req.url);

    if (!routeConfig) {
      res.status(404).json({ error: "Route not found" });
      return;
    }

    if (routeConfig.requestHooks?.guards) {
      const isAllowed = await this.routeHandleService.checkGuards(routeConfig.requestHooks.guards, req, res);

      if (!isAllowed) return;
    }

    if (isSocketRequest(req)) {
      await this.wsProxyService.proxyRequest(req, res, routeConfig);
      return;
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
