import { Injectable, Type, ExecutionContext, RequestMethod, CanActivate, Inject } from "@nestjs/common";
import { lastValueFrom, Observable } from "rxjs";
import { Request, Response } from "express";
import { ModuleRef } from "@nestjs/core";
import { match } from "path-to-regexp";

import { HookRoute, ProxyRouteConfig, RequestHook } from "../types";
import { GLOBAL_GUARDS, PROXY_ROUTES_CONFIG } from "../constants";

@Injectable()
export class RouteHandleService {
  constructor(
    @Inject(PROXY_ROUTES_CONFIG) private readonly routesConfig: Array<ProxyRouteConfig>,
    @Inject(GLOBAL_GUARDS) private readonly globalGuards: Array<Type<CanActivate>>,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef
  ) {}

  /**
   * Finds a matching route configuration for the given URL.
   *
   * @param url - The request URL to match.
   * @returns The matching route configuration, or undefined if none found.
   */
  findMatchingRoute(path: string): ProxyRouteConfig | undefined {
    return this.routesConfig.find((config) => match(config.route)(path));
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
    const allGuards = [...this.globalGuards, ...guards];

    for (let i = 0; i < allGuards.length; i++) {
      const guard = allGuards[i];

      const isGlobalGuard = i < this.globalGuards.length;

      const shouldRun = typeof guard === "function" ? true : isGlobalGuard || this.shouldApplyHook(req, guard.includes, guard.excludes);

      if (!shouldRun) continue;

      const instance = typeof guard === "function" ? guard : guard.instance;
      const result = await this.executeGuard(instance, req, res);

      if (!result) {
        res.status(401).json({ message: "Unauthorized" });
        return false;
      }
    }

    return true;
  }

  /**
   * Determines whether a hook should be applied to the given request based on inclusion and exclusion rules.
   *
   * @param req - The incoming HTTP request object.
   * @param includes - An optional array of routes to include. If provided, the hook will only be applied
   *                   if the request matches one of these routes.
   * @param excludes - An optional array of routes to exclude. If provided, the hook will not be applied
   *                   if the request matches one of these routes.
   * @returns A boolean indicating whether the hook should be applied to the request.
   */
  private shouldApplyHook(req: Request, includes?: HookRoute[], excludes?: HookRoute[]): boolean {
    const method = RequestMethod[req.method];

    const isMatch = (routes?: HookRoute[], defaultV: boolean = true) =>
      routes?.some((route) => (route.method === method || route.method === RequestMethod.ALL) && match(route.path)(req.url)) ?? defaultV;

    return isMatch(includes) && !isMatch(excludes, false);
  }

  /**
   * Executes a guard by resolving it from the module reference and invoking its `canActivate` method.
   * Handles both synchronous and asynchronous results, including observables.
   *
   * @template Guard - The type of the guard to be executed, which must implement the `CanActivate` interface.
   * @param Guard - The class type of the guard to be resolved and executed.
   * @param request - The HTTP request object to be passed to the guard's execution context.
   * @param response - The HTTP response object to be passed to the guard's execution context.
   * @returns A promise that resolves to `true` if the guard allows activation, or `false` otherwise.
   */
  private async executeGuard(Guard: Type<CanActivate>, request: Request, response: Response): Promise<boolean> {
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
}
