import { CanActivate, DynamicModule, NestMiddleware, Provider, Type } from "@nestjs/common";

import { HttpProxyService, GatewayService, RouteHandleService, WsProxyService } from "./services";
import { GLOBAL_GUARDS, PROXY_ROUTES_CONFIG } from "./constants";
import type { GatewayRoutingConfig, RequestHook } from "./types";
import { GatewayController } from "./controllers";
import { GatewayModule } from "./gateway.module";
import { DEFAULT_PROTOCOL } from "../../common";

/**
 * Builder class for configuring proxy routes and middlewares.
 */
export class GatewayConfigBuilder {
  private globalMiddlewares: Array<Type<NestMiddleware>> = [];
  private globalGuards: Array<Type<CanActivate>> = [];
  private routes: Array<GatewayRoutingConfig> = [];
  private providers: Array<Provider> = [RouteHandleService, HttpProxyService, WsProxyService, GatewayService];

  /**
   * Adds a route configuration.
   *
   * @param config - The route configuration, including optional targetPath as string or function.
   * @returns This builder instance.
   */
  private route(config: GatewayRoutingConfig): this {
    this.routes.push({
      ...config,
      protocol: config.protocol || DEFAULT_PROTOCOL, // Default to HTTP
    });

    this.registerRequestHookProviders(config);

    return this;
  }

  /**
   * Adds an HTTP route configuration.
   *
   * @param config - The route configuration without protocol.
   * @returns This builder instance.
   */
  httpRoute(config: Omit<GatewayRoutingConfig, "protocol">): this {
    return this.route({ ...config, protocol: "http" });
  }

  /**
   * Adds a WebSocket route configuration.
   *
   * @param config - The route configuration without protocol.
   * @returns This builder instance.
   */
  wsRoute(config: Omit<GatewayRoutingConfig, "protocol">): this {
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
  private registerRequestHookProviders(config: GatewayRoutingConfig): void {
    const extractProviders = <T>(items: RequestHook<T>[] = []) => {
      return items.map((hook) => (typeof hook === "function" ? hook : hook.instance));
    };

    if (config.guards) {
      this.providers.push(...extractProviders(config.guards));
    }

    if (config.middlewares) {
      this.providers.push(...extractProviders(config.middlewares));
    }
  }

  /**
   * Builds the proxy module with configured routes and middlewares.
   *
   * @returns A dynamic module configuration.
   */
  build(): DynamicModule {
    GatewayModule.routes = this.routes;
    GatewayModule.globalMiddlewares = this.globalMiddlewares;

    this.providers.push(
      {
        provide: PROXY_ROUTES_CONFIG,
        useValue: this.routes,
      },
      {
        provide: GLOBAL_GUARDS,
        useValue: this.globalGuards,
      }
    );

    return {
      module: GatewayModule,
      controllers: [GatewayController],
      providers: this.providers,
      exports: this.providers,
    };
  }
}
