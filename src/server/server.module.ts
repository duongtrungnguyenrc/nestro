import { Module, DynamicModule, NestModule, MiddlewareConsumer, RequestMethod, Provider, Type } from "@nestjs/common";

import { DiscoveryController, RegistryController } from "./controllers";
import { DEFAULT_CLEANUP_TTL, HANDLEBARS_HELPERS } from "./constants";
import { SecurityMiddleware, SecurityModule } from "src/security";
import { registerHandlebarsHelpers } from "./helpers";
import { NestroServerConfig } from "./types";
import { RegistryService } from "./services";

@Module({})
export class ServerModule implements NestModule {
  static register(config?: NestroServerConfig): DynamicModule {
    const registryServiceProvider: Provider = {
      provide: RegistryService,
      useFactory: () => {
        return new RegistryService({
          cleanupTTL: config?.cleanupTTL ?? DEFAULT_CLEANUP_TTL,
          strategy: config.strategy ?? "round-robin",
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

    if (config?.enableRegistryDashboard ?? true) {
      controllers.push(DiscoveryController);
      providers.push(hbsHelperProvider);
    }

    return {
      module: ServerModule,
      imports: [
        SecurityModule.register({
          ...(config ?? {}),
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
        { path: "/nestro/dashboard(.*)", method: RequestMethod.ALL }
      )
      .forRoutes("/nestro/*");
  }
}
