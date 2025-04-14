import { CanActivate, DynamicModule, NestMiddleware, Provider, Type, ValueProvider } from "@nestjs/common";

import type { ProxyRouteConfig, ProxyRequestHooks, RequestHook } from "./types";
import { GLOBAL_GUARDS, PROXY_ROUTES_CONFIG } from "./constants";
import { HttpProxyService, ProxyService, RouteHandleService, WsProxyService } from "./services";
import { ProxyController } from "./proxy.controller";
import { ProxyModule } from "./proxy.module";

/**
 * Builder class for configuring proxy routes and middlewares.
 */
export class ProxyModuleBuilder {
  private globalMiddlewares: Array<Type<NestMiddleware>> = [];
  private globalGuards: Array<Type<CanActivate>> = [];
  private routes: ProxyRouteConfig[] = [];
  private providers: Provider[] = [];

  /**
   * Adds a route configuration.
   *
   * @param config - The route configuration, including optional targetPath as string or function.
   * @returns This builder instance.
   */
  route(config: ProxyRouteConfig): this {
    this.routes.push({
      ...config,
      protocol: config.protocol || "http", // Default to HTTP
    });

    // Register providers from request hooks if any
    if (config.requestHooks) {
      this.registerRequestHookProviders(config.requestHooks);
    }

    return this;
  }

  /**
   * Adds an HTTP route configuration.
   *
   * @param config - The route configuration without protocol.
   * @returns This builder instance.
   */
  httpRoute(config: Omit<ProxyRouteConfig, "protocol">): this {
    return this.route({ ...config, protocol: "http" });
  }

  /**
   * Adds a WebSocket route configuration.
   *
   * @param config - The route configuration without protocol.
   * @returns This builder instance.
   */
  wsRoute(config: Omit<ProxyRouteConfig, "protocol">): this {
    return this.route({ ...config, protocol: "ws" });
  }

  /**
   * Adds global middlewares to be applied to all routes.
   *
   * @param middlewares - Middleware classes to apply.
   * @returns This builder instance.
   */
  useGlobalMiddleware(...middlewares: Array<Type<NestMiddleware>>): this {
    this.globalMiddlewares.push(...middlewares);
    return this;
  }

  useGlobalGuard(...guards: Array<Type<CanActivate>>): this {
    this.globalGuards.push(...guards);
    return this;
  }

  /**
   * Register providers from request hooks
   */
  private registerRequestHookProviders(hooks: ProxyRequestHooks): void {
    const extractProviders = <T>(items: RequestHook<T>[] = []) => {
      return items.map((hook) => (typeof hook === "function" ? hook : hook.instance));
    };

    if (hooks.guards) {
      this.providers.push(...extractProviders(hooks.guards));
    }

    if (hooks.middlewares) {
      this.providers.push(...extractProviders(hooks.middlewares));
    }
  }

  /**
   * Builds the proxy module with configured routes and middlewares.
   *
   * @returns A dynamic module configuration.
   */
  build(): DynamicModule {
    ProxyModule.routes = this.routes;
    ProxyModule.globalMiddlewares = this.globalMiddlewares;

    const routesConfigProvider: ValueProvider<ProxyRouteConfig[]> = {
      provide: PROXY_ROUTES_CONFIG,
      useValue: this.routes,
    };

    const globalGuardsProvider: ValueProvider<Array<Type<CanActivate>>> = {
      provide: GLOBAL_GUARDS,
      useValue: this.globalGuards,
    };

    return {
      module: ProxyModule,
      controllers: [ProxyController],
      providers: [
        routesConfigProvider,
        globalGuardsProvider,
        RouteHandleService,
        HttpProxyService,
        WsProxyService,
        ProxyService,
        ...this.providers,
      ],
      exports: [RouteHandleService, HttpProxyService, WsProxyService, ProxyService],
    };
  }
}
