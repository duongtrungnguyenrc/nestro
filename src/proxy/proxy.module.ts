import { DynamicModule, MiddlewareConsumer, Module, NestModule, Type } from "@nestjs/common";

import { PROXY_ROUTES_CONFIG } from "../client/constants";
import { ProxyController } from "./proxy.controller";
import type { ProxyRouteConfig } from "./types";
import { ProxyService } from "./proxy.service";

@Module({})
export class ProxyModule implements NestModule {
  public static routes: ProxyRouteConfig[] = [];
  public static globalMiddleware: Type<any>[] = [];

  static builder() {
    return new ProxyModuleBuilder();
  }

  configure(consumer: MiddlewareConsumer) {
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

export class ProxyModuleBuilder {
  private routes: ProxyRouteConfig[] = [];
  private middleware: Type<any>[] = [];

  route(config: ProxyRouteConfig) {
    this.routes.push(config);
    return this;
  }

  useGlobalMiddleware(...middleware: Type<any>[]) {
    this.middleware.push(...middleware);
    return this;
  }

  build(): DynamicModule {
    ProxyModule.routes = this.routes;
    ProxyModule.globalMiddleware = this.middleware;

    return {
      module: ProxyModule,
      controllers: [ProxyController],
      providers: [ProxyService, { provide: PROXY_ROUTES_CONFIG, useValue: this.routes }],
      exports: [ProxyService],
    };
  }
}
