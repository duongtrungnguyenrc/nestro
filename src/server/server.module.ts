import { Module, DynamicModule, NestModule, MiddlewareConsumer, RequestMethod, Provider, Type } from "@nestjs/common";

import { DashboardController, RegistryController } from "./controllers";
import { SecurityMiddleware, SecurityModule } from "../security";
import { NestroServerConfig } from "./types";
import { RegistryService } from "./services";
import { StorageModule } from "../storage";

@Module({})
export class ServerModule implements NestModule {
  private static _config: NestroServerConfig = {};

  static register(config?: NestroServerConfig): DynamicModule {
    this._config = config ?? {};

    const controllers: Array<Type<any>> = [RegistryController];
    const providers: Array<Provider> = [RegistryService];
    const imports: Array<Type<any> | DynamicModule> = [StorageModule.register(this._config.storage ?? {})];

    if (this._config.enableRegistryDashboard) {
      controllers.push(DashboardController);
    }

    if (this._config.enableSecurity) {
      imports.push(
        SecurityModule.register({
          ...(this._config.security ?? {}),
          initKeys: true,
        })
      );
    }

    return {
      module: ServerModule,
      imports,
      providers,
      controllers,
      exports: [RegistryService],
      global: true,
    };
  }

  configure(consumer: MiddlewareConsumer) {
    if (ServerModule._config.enableSecurity) {
      consumer
        .apply(SecurityMiddleware)
        .exclude({ path: "/nestro/services", method: RequestMethod.GET }, { path: "/nestro/dashboard(.*)", method: RequestMethod.ALL })
        .forRoutes("/nestro/*");
    }
  }
}
