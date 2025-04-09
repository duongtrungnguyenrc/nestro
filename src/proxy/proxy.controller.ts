import { Controller, All, Req, Res, Inject, CanActivate, ExecutionContext, RawBodyRequest, Type } from "@nestjs/common";
import { version } from "@nestjs/core/package.json";
import { Request, Response } from "express";
import { match } from "path-to-regexp";

import { PROXY_ROUTES_CONFIG } from "../client/constants";
import type { ProxyRouteConfig } from "./types";
import { ProxyService } from "./proxy.service";

@Controller()
export class ProxyController {
  constructor(
    @Inject(ProxyService) private readonly proxyService: ProxyService,
    @Inject(PROXY_ROUTES_CONFIG) private readonly routesConfig: ProxyRouteConfig[]
  ) {}

  @All(version.startsWith("10") ? "*" : "*splat")
  handleRequest(@Req() req: RawBodyRequest<Request>, @Res() res: Response) {
    const routeConfig = this.findMatchingRoute(req.url);

    if (!routeConfig) {
      return res.status(404).json({ error: "Route not found" });
    }

    if (routeConfig.guards?.length) {
      if (!this.guardCheck(routeConfig.guards, req)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    return this.proxyService.proxyRequest(req, res, routeConfig);
  }

  private guardCheck(guards: Array<Type<CanActivate>>, request: Request) {
    return guards.every((guard) => {
      const instance = new guard();

      return instance.canActivate({ switchToHttp: () => ({ getRequest: () => request }) } as ExecutionContext);
    });
  }

  private findMatchingRoute(url: string): ProxyRouteConfig | undefined {
    for (const routeConfig of this.routesConfig) {
      const matcher = match(routeConfig.route, { decode: decodeURIComponent });
      if (matcher(url)) {
        return routeConfig;
      }
    }

    return undefined;
  }
}
