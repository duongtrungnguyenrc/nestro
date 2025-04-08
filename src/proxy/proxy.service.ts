import { Inject, Injectable } from "@nestjs/common";
import { createProxyServer } from "http-proxy";
import { Request, Response } from "express";

import { LoadBalancingService } from "../loadbalancing";
import type { ProxyRouteConfig } from "./types";
import { buildUrl, debugLog } from "../common";

@Injectable()
export class ProxyService {
  private proxy = createProxyServer();

  constructor(@Inject(LoadBalancingService) private readonly clientLoadBalancingService: LoadBalancingService) {}

  proxyRequest(req: Request, res: Response, routeConfig: ProxyRouteConfig) {
    try {
      return this.clientLoadBalancingService.executeWithRetry(routeConfig.target, (instance) => {
        let targetPath: string = req.url;
        req.url = "";

        if (routeConfig.rewritePath) {
          targetPath = routeConfig.rewritePath(targetPath);
        }

        const targetUrl = `${buildUrl(instance.host, instance.protocol, instance.port)}${targetPath}`;

        this.proxy.web(req, res, { target: targetUrl, changeOrigin: true }, (err) => {
          debugLog("Proxy", `Proxy failed with cause ${err}, Retrying...`);
          throw err;
        });
      });
    } catch (error) {
      res.status(500).json({ error: "Proxy error", details: error.message });
    }
  }
}
