import { ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Request, Response } from "express";
import { Observable } from "rxjs";

import { ProxyService } from "./proxy.service";
import { ProxyOptions } from "./types";

@Injectable()
export class ProxyInterceptor implements NestInterceptor {
  constructor(private readonly options: ProxyOptions, private readonly proxyService?: ProxyService) {}

  intercept(context: ExecutionContext): Observable<any> {
    const httpContext = context.switchToHttp();
    const req: Request = httpContext.getRequest();
    const res: Response = httpContext.getResponse();

    // Get the proxy service from the request app context if not injected
    const proxyService = this.proxyService || req.app.get("HttpProxyService");

    if (!proxyService) {
      throw new Error("HttpProxyService not found. Make sure ProxyModule is imported.");
    }

    // Proxy the request
    proxyService.web(req, res, this.options);

    // Return empty observable since the proxy handles the response
    return new Observable();
  }
}
