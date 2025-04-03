import { Controller, All, Req, Res, Inject, CanActivate, ExecutionContext } from "@nestjs/common";
import { Request, Response } from "express";

import { PROXY_ROUTES_CONFIG } from "../constants";
import type { ProxyRouteConfig } from "../types";
import { ProxyService } from "../services";

@Controller()
export class ProxyController {
  constructor(
    @Inject(ProxyService) private readonly proxyService: ProxyService,
    @Inject(PROXY_ROUTES_CONFIG) private readonly routes: ProxyRouteConfig[]
  ) {}

  @All("*")
  async handleRequest(@Req() req: Request, @Res() res: Response) {
    const routeConfig = this.findMatchingRoute(req.url);

    if (!routeConfig) {
      return res.status(404).json({ error: "Route not found" });
    }

    if (routeConfig.guards?.length) {
      const canActivateGuards = routeConfig.guards.every((guard) => {
        const instance = new guard() as CanActivate;
        return instance.canActivate({ switchToHttp: () => ({ getRequest: () => req }) } as ExecutionContext);
      });

      if (!canActivateGuards) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    return this.proxyService.proxyRequest(req, res, routeConfig);
  }

  private findMatchingRoute(url: string): ProxyRouteConfig | undefined {
    return this.routes.find((route) => {
      const pattern = new RegExp(`^${route.route.replace(/\*/g, ".*")}$`);
      return pattern.test(url);
    });
  }
}
