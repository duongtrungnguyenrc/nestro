import { DynamicModule, MiddlewareConsumer, Module, NestModule, Type, ValueProvider } from "@nestjs/common";

import { PROXY_ROUTES_CONFIG } from "../client/constants";
import { ProxyController } from "./proxy.controller";
import type { ProxyRouteConfig } from "./types";
import { ProxyService } from "./proxy.service";

/**
 * Module for configuring and registering proxy routes.
 * Supports HTTP, WebSocket, and Socket.IO with flexible target path configuration.
 */
@Module({})
export class ProxyModule implements NestModule {
  static routes: ProxyRouteConfig[] = [];
  static globalMiddleware: Type<any>[] = [];

  /**
   * Creates a builder for configuring proxy routes and middleware.
   *
   * @returns A new ProxyModuleBuilder instance.
   */
  static builder(): ProxyModuleBuilder {
    return new ProxyModuleBuilder();
  }

  /**
   * Configures middleware for the proxy module.
   *
   * @param consumer - The middleware consumer.
   */
  configure(consumer: MiddlewareConsumer): void {
    if (ProxyModule.globalMiddleware.length) {
      consumer.apply(...ProxyModule.globalMiddleware).forRoutes(ProxyController);
    }

    ProxyModule.routes.forEach((route) => {
      if (route.middlewares?.length) {
        consumer.apply(...route.middlewares).forRoutes(route.route);
      }
    });
  }
}

/**
 * Builder class for configuring proxy routes and middleware.
 */
export class ProxyModuleBuilder {
  private routes: ProxyRouteConfig[] = [];
  private middleware: Type<any>[] = [];

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
   * Adds global middleware to be applied to all routes.
   *
   * @param middleware - Middleware classes to apply.
   * @returns This builder instance.
   */
  useGlobalMiddleware(...middleware: Type<any>[]): this {
    this.middleware.push(...middleware);
    return this;
  }

  /**
   * Builds the proxy module with configured routes and middleware.
   *
   * @returns A dynamic module configuration.
   */
  build(): DynamicModule {
    ProxyModule.routes = this.routes;
    ProxyModule.globalMiddleware = this.middleware;

    const routeConfigProvider: ValueProvider<ProxyRouteConfig[]> = {
      provide: PROXY_ROUTES_CONFIG,
      useValue: this.routes,
    };

    return {
      module: ProxyModule,
      controllers: [ProxyController],
      providers: [routeConfigProvider, ProxyService],
      exports: [ProxyService],
    };
  }
}
