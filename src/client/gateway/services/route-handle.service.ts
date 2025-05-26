import { Injectable, Type, ExecutionContext, CanActivate, Inject, RequestMethod, HttpStatus } from "@nestjs/common";
import { lastValueFrom, Observable } from "rxjs";
import { Request, Response } from "express";
import { ModuleRef } from "@nestjs/core";
import { match } from "path-to-regexp";
import { Socket } from "socket.io";

import type { HookRoute, GatewayRoutingConfig, RequestHook } from "../types";
import { GLOBAL_GUARDS, PROXY_ROUTES_CONFIG } from "../constants";

@Injectable()
export class RouteHandleService {
  constructor(
    @Inject(PROXY_ROUTES_CONFIG) private readonly routesConfig: GatewayRoutingConfig[],
    @Inject(GLOBAL_GUARDS) private readonly globalGuards: Array<Type<CanActivate>>,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef
  ) {}

  findMatchingRoute(path: string): GatewayRoutingConfig | undefined {
    return this.routesConfig.find((config) => match(config.route)(path));
  }

  async checkGuards(guards: Array<RequestHook<CanActivate>> = [], req: Request, res: Response): Promise<boolean> {
    const allGuards = [...this.globalGuards, ...guards];

    for (let i = 0; i < allGuards.length; i++) {
      const guard = allGuards[i];
      const isGlobalGuard = i < this.globalGuards.length;
      const shouldRun = typeof guard === "function" ? true : isGlobalGuard || this.shouldApplyHook(req, guard.includes, guard.excludes);

      if (!shouldRun) continue;

      const instance = typeof guard === "function" ? guard : guard.instance;

      const context = this.createExecutionContext(req, res);
      const result = await this.executeGuard(instance, context);

      if (!result) {
        if ("switchToWs" in context) {
          const socket = context.switchToWs().getClient<Socket>();
          socket.emit("error", {
            message: "Unauthorized",
            timestamp: new Date().toISOString(),
          });
          socket.disconnect();
        } else {
          res.status(401).json({
            message: "Unauthorized",
            timestamp: new Date().toISOString(),
            statusCode: HttpStatus.UNAUTHORIZED,
          });
        }
        return false;
      }
    }

    return true;
  }

  private shouldApplyHook(req: Request | Socket, includes?: HookRoute[], excludes?: HookRoute[]): boolean {
    const isSocket = "handshake" in req;
    const method = isSocket ? "WS" : RequestMethod[req.method];
    const url = isSocket ? req.handshake.url : req.url;

    const isMatch = (routes?: HookRoute[], defaultV: boolean = true) =>
      routes?.some((route) => (route.method === method || route.method === RequestMethod.ALL || method === "WS") && match(route.path)(url)) ??
      defaultV;

    return isMatch(includes) && !isMatch(excludes, false);
  }

  private async executeGuard(Guard: Type<CanActivate> | Function, context: ExecutionContext): Promise<boolean> {
    const instance = typeof Guard === "function" ? Guard : await this.moduleRef.resolve(Guard);

    try {
      const result = await instance.canActivate(context);
      if (result instanceof Observable) {
        return await lastValueFrom(result);
      }
      return result;
    } catch {
      return false;
    }
  }

  private createExecutionContext(req: Request | Socket, res?: Response): ExecutionContext {
    const isSocket = "handshake" in req;

    if (isSocket) {
      return {
        switchToWs: () => ({
          getClient: () => req as Socket,
        }),
      } as ExecutionContext;
    }

    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as ExecutionContext;
  }
}
