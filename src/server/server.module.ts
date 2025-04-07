import { Module, DynamicModule, NestModule, MiddlewareConsumer, RequestMethod, Provider, Type } from "@nestjs/common";

import { DashboardController, RegistryController } from "./controllers";
import { SecurityMiddleware, SecurityModule } from "../security";
import { NestroServerConfig } from "./types";
import { RegistryService } from "./services";
import { StorageModule } from "../storage";

@Module({})
export class ServerModule implements NestModule {
  static register(config?: NestroServerConfig): DynamicModule {
    const controllers: Array<Type<any>> = [RegistryController];
    const providers: Array<Provider> = [RegistryService];

    if (config?.enableRegistryDashboard ?? true) {
      controllers.push(DashboardController);
    }

    return {
      module: ServerModule,
      imports: [
        StorageModule.register(config.storage ?? {}),
        SecurityModule.register({
          ...(config.security ?? {}),
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
