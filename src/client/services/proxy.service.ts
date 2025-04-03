import { Inject, Injectable } from "@nestjs/common";
import { createProxyServer } from "http-proxy";
import { Request, Response } from "express";

import { ClientLoadBalancerService } from "./client-load-balancer.service";
import { debugLog, ServiceInstance } from "src/common";
import { ProxyRouteConfig } from "../types";

@Injectable()
export class ProxyService {
  private proxy = createProxyServer();

  constructor(
    @Inject(ClientLoadBalancerService) private readonly clientLoadBalancerService: ClientLoadBalancerService
  ) {}

  proxyRequest(req: Request, res: Response, routeConfig: ProxyRouteConfig) {
    let targetService: ServiceInstance | null = this.clientLoadBalancerService.getNextInstance(routeConfig.target);

    if (!targetService) {
      return res.status(502).json({ error: "Service not available" });
    }

    let targetPath: string = req.url;
    req.url = "";

    if (routeConfig.rewritePath) {
      targetPath = routeConfig.rewritePath(targetPath);
    }

    const attemptProxy = async (attempt = 1) => {
      if (!targetService) {
        return res.status(502).json({ error: "Service not available after retries" });
      }

      const targetUrl = `${targetService.protocol}://${targetService.host}${
        targetService.port ? `:${targetService.port}` : ""
      }${targetPath}`;

      debugLog("Proxy", `Forwarding to ${targetUrl} (Attempt: ${attempt})`);

      this.proxy.web(req, res, { target: targetUrl, changeOrigin: true }, async (err) => {
        console.error(`Error forwarding to ${targetUrl}:`, err.message);

        if (attempt < routeConfig.retryLimit) {
          debugLog("Proxy", `Retrying... (${attempt + 1}/${routeConfig.retryLimit})`);
          targetService = this.clientLoadBalancerService.getNextInstance(routeConfig.target);
          attemptProxy(attempt + 1);
        } else {
          debugLog(
            "Proxy",
            `Service ${routeConfig.target} failed after ${routeConfig.retryLimit} attempts. Removing from registry.`
          );
          this.clientLoadBalancerService.markInstanceFailed(targetService.name, targetService);
          res.status(500).json({ error: "Proxy error", details: err.message });
        }
      });
    };

    attemptProxy();
  }
}
