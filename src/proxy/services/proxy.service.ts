import { Inject, Injectable } from "@nestjs/common";
import { createProxyServer } from "http-proxy";
import { Request, Response } from "express";

import { RegistryService } from "../../registry";
import { ProxyRouteConfig } from "../types";
import { debugLog } from "../../utils";

@Injectable()
export class ProxyService {
  private proxy = createProxyServer();

  constructor(@Inject(RegistryService) private readonly registryService: RegistryService) {}

  async proxyRequest(req: Request, res: Response, routeConfig: ProxyRouteConfig) {
    let targetService = await this.registryService.getService(routeConfig.target, req.ip);

    if (!targetService) {
      return res.status(502).json({ error: "Service not available" });
    }

    let targetPath = req.url.replace(routeConfig.route, "") || "/";

    if (routeConfig.rewritePath) {
      targetPath = routeConfig.rewritePath(targetPath);
    }

    req.url = "";

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
          targetService = await this.registryService.getService(routeConfig.target, req.ip);
          attemptProxy(attempt + 1);
        } else {
          debugLog(
            "Proxy",
            `Service ${routeConfig.target} failed after ${routeConfig.retryLimit} attempts. Removing from registry.`
          );
          await this.registryService.deregister(targetService);
          res.status(500).json({ error: "Proxy error", details: err.message });
        }
      });
    };

    attemptProxy();
  }
}
