import { DynamicModule, MiddlewareConsumer, Module, NestMiddleware, NestModule, Type } from "@nestjs/common";

import type { HookRoute, GatewayRoutingConfig, GatewayRoutingConfigFunction } from "./types";
import { GatewayConfigBuilder } from "./config-builder";
import { GatewayController } from "./controllers";
import { IGatewayConfig } from "./interfaces";
import { isClass } from "../../common";
/**
 * Module for configuring and registering proxy routes.
 * Supports HTTP, WebSocket, and Socket.IO with flexible target path configuration.
 */
@Module({})
export class GatewayModule implements NestModule {
  static routes: Array<GatewayRoutingConfig> = [];
  static globalMiddlewares: Array<Type<NestMiddleware>> = [];

  /**
   * Creates a builder for configuring proxy routes and middlewares.
   *
   * @returns A new GatewayConfigBuilder instance.
   */
  static builder(): GatewayConfigBuilder {
    return new GatewayConfigBuilder();
  }

  /**
   * Registers and configures the GatewayModule dynamically.
   *
   * This method accepts either a class type implementing `IGatewayConfig` or a `GatewayRoutingConfigFunction`.
   * If a configuration function is provided, it is invoked with a `GatewayConfigBuilder` instance to produce
   * a `DynamicModule` or a `Promise<DynamicModule>`. If a class type is provided, an instance is created and
   * its `build` method is called with the builder.
   *
   * @param config - A class type implementing `IGatewayConfig` or a configuration function (`GatewayRoutingConfigFunction`)
   *                that receives a `GatewayConfigBuilder` and returns a `DynamicModule` or a `Promise<DynamicModule>`.
   * @returns A `DynamicModule` or a `Promise<DynamicModule>` representing the configured gateway module.
   */
  static register(config: Type<IGatewayConfig> | GatewayRoutingConfigFunction): DynamicModule | Promise<DynamicModule> {
    const builder = new GatewayConfigBuilder();

    if (!isClass(config)) {
      return (config as GatewayRoutingConfigFunction)(builder);
    }

    const instance = new (config as Type<IGatewayConfig>)();

    return instance.build(builder);
  }

  configure(consumer: MiddlewareConsumer): void {
    if (GatewayModule.globalMiddlewares.length) {
      consumer.apply(...GatewayModule.globalMiddlewares).forRoutes(GatewayController);
    }

    GatewayModule.routes.forEach((route) => {
      if (!route.middlewares?.length) return;

      const middlewares: Array<Type<NestMiddleware>> = [];
      const excludes: HookRoute[] = [];

      route.middlewares.forEach((hook) => {
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
