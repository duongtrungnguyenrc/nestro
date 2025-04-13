import { Injectable, Type, ExecutionContext, RequestMethod, CanActivate, Inject } from "@nestjs/common";
import { lastValueFrom, Observable } from "rxjs";
import { Request, Response } from "express";
import * as path from "path";

import { HookExclude, ProxyRouteConfig, RequestHook } from "../types";
import { GLOBAL_GUARDS, PROXY_ROUTES_CONFIG } from "../constants";
import { ModuleRef } from "@nestjs/core";

@Injectable()
export class RouteHandleService {
  constructor(
    @Inject(PROXY_ROUTES_CONFIG) private readonly routesConfig: ProxyRouteConfig[],
    @Inject(GLOBAL_GUARDS) private readonly globalGuards: Type<CanActivate>[],
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef
  ) {}

  /**
   * Finds a matching route configuration for the given URL.
   *
   * @param url - The request URL to match.
   * @returns The matching route configuration, or undefined if none found.
   */
  findMatchingRoute(path: string): ProxyRouteConfig | undefined {
    return this.routesConfig.find((config) => new RegExp(config.route).test(path));
  }

  /**
   * Checks if all guards allow the request to proceed.
   *
   * @param guards - Array of guard classes to check.
   * @param request - The incoming request.
   * @param response - The outgoing response.
   * @returns True if all guards pass, false otherwise.
   */
  async checkGuards(guards: Array<RequestHook<CanActivate>>, req: Request, res: Response): Promise<boolean> {
    const allGuards: Array<RequestHook<CanActivate>> = [...this.globalGuards, ...guards];

    const resolveGuards = async () => {
      for (const [index, guard] of allGuards.entries()) {
        if (typeof guard === "function") {
          return await this.executeGuard(guard, req, res);
        }

        const isGlobalGuard = index < this.globalGuards.length;

        if (isGlobalGuard || this.shouldApplyHook(guard.excludes, req)) {
          return await this.executeGuard(guard.instance, req, res);
        }
      }

      return true;
    };

    const result = await resolveGuards();

    if (!result) {
      res.status(403).json({ message: "Forbidden" });
    }

    return result;
  }

  shouldApplyHook(excludes: HookExclude[] = [], req: Request): boolean {
    return !excludes.some((exclude) => {
      return (
        new RegExp(exclude.path).test(path.join(req.url)) &&
        (exclude.method === RequestMethod[req.method] || exclude.method === RequestMethod.ALL)
      );
    });
  }

  async executeGuard(Guard: Type<CanActivate>, request: Request, response: Response): Promise<boolean> {
    const guard = await this.moduleRef.resolve(Guard);
    const context: ExecutionContext = {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    } as ExecutionContext;

    const result = await guard.canActivate(context);

    if (result instanceof Observable) {
      try {
        return await lastValueFrom(result);
      } catch {
        return false;
      }
    }

    return result;
  }

  /**
   * Determines if the request is a WebSocket upgrade request.
   *
   * @param req - The incoming request.
   * @returns True if the request is for WebSocket, false otherwise.
   */
  isWebSocketRequest(req: Request): boolean {
    return !!req.headers.upgrade && req.headers.upgrade.toLowerCase() === "websocket";
  }
}
