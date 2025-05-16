import { DynamicModule, MiddlewareConsumer, Module, NestMiddleware, NestModule, Type } from "@nestjs/common";

import type { HookRoute, IGatewayConfig, ProxyRouteConfig, RoutingConfigFunction } from "./types";
import { ProxyModuleBuilder } from "./proxy-module.builder";
import { ProxyController } from "./controllers";
import { isClass } from "../common";
/**
 * Module for configuring and registering proxy routes.
 * Supports HTTP, WebSocket, and Socket.IO with flexible target path configuration.
 */
@Module({})
export class ProxyModule implements NestModule {
  static routes: Array<ProxyRouteConfig> = [];
  static globalMiddlewares: Array<Type<NestMiddleware>> = [];

  /**
   * Creates a builder for configuring proxy routes and middlewares.
   *
   * @returns A new ProxyModuleBuilder instance.
   */
  static builder(): ProxyModuleBuilder {
    return new ProxyModuleBuilder();
  }

  static config(config: Type<IGatewayConfig> | RoutingConfigFunction): DynamicModule | Promise<DynamicModule> {
    const builder = new ProxyModuleBuilder();

    if (!isClass(config)) {
      return (config as RoutingConfigFunction)(builder);
    }

    const instance = new (config as Type<IGatewayConfig>)();

    return instance.build(builder);
  }

  /**
   * Configures middlewares for the proxy module.
   *
   * @param consumer - The middlewares consumer.
   */
  configure(consumer: MiddlewareConsumer): void {
    if (ProxyModule.globalMiddlewares.length) {
      consumer.apply(...ProxyModule.globalMiddlewares).forRoutes(ProxyController);
    }

    ProxyModule.routes.forEach((route) => {
      const middlewareHooks = route.requestHooks?.middlewares;
      if (!middlewareHooks?.length) return;

      const middlewares: Array<Type<NestMiddleware>> = [];
      const excludes: HookRoute[] = [];

      middlewareHooks.forEach((hook) => {
        if (typeof hook === "function") {
          middlewares.push(hook);
        } else {
          middlewares.push(hook.instance);
          if (hook.excludes?.length) {
            excludes.push(...hook.excludes);
          }
        }
      });

      if (middlewares.length) {
        const applied = consumer.apply(...middlewares);

        if (excludes.length) {
          applied.exclude(...excludes).forRoutes(route.route);
        } else {
          applied.forRoutes(route.route);
        }
      }
    });
  }
}
