import { Module, DynamicModule, NestModule, MiddlewareConsumer, RequestMethod, Provider, Type } from "@nestjs/common";

import { DiscoveryController, RegistryController } from "./controllers";
import { DEFAULT_CLEANUP_TTL, HANDLEBARS_HELPERS } from "./constants";
import { SecurityModule, SecurityMiddleware } from "../security";
import { registerHandlebarsHelpers } from "./helpers";
import type { NestroServerOptions } from "../types";
import { RegistryService } from "./services";

@Module({})
export class RegistryModule implements NestModule {
  static register(options?: NestroServerOptions): DynamicModule {
    const registryServiceProvider: Provider = {
      provide: RegistryService,
      useFactory: () => {
        return new RegistryService({
          cleanupTTL: options?.cleanupTTL ?? DEFAULT_CLEANUP_TTL,
          loadBalancingStrategy: options.loadBalancingStrategy ?? "least-connections",
        });
      },
    };

    const hbsHelperProvider: Provider = {
      provide: HANDLEBARS_HELPERS,
      useFactory: () => {
        registerHandlebarsHelpers();
        return {};
      },
    };

    const controllers: Array<Type<any>> = [RegistryController];
    const providers: Array<Provider> = [registryServiceProvider];

    if (options?.enableServiceDiscovery ?? true) {
      controllers.push(DiscoveryController);
      providers.push(hbsHelperProvider);
    }

    return {
      module: RegistryModule,
      imports: [
        SecurityModule.register({
          ...(options ?? {}),
          initKeys: true,
        }),
      ],
      providers,
      controllers,
      exports: [RegistryService],
      global: true,
    };
  }

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityMiddleware)
      .exclude(
        { path: "/nestro/services", method: RequestMethod.GET },
        { path: "/nestro/discovery(.*)", method: RequestMethod.ALL }
      )
      .forRoutes("/nestro/*");
  }
}
