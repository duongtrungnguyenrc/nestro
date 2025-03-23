import { Module, Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import type { INestroApplication, NestroApplicationOptions, NestroServerOptions } from "./types";
import { RegistryModule } from "./registry";
import { ClientModule } from "./client";

function wrapModuleWithRegistry(AppModule: any, options: NestroApplicationOptions): any {
  @Module({
    imports: [ClientModule.register(options), AppModule],
  })
  class WrappedModule {}

  return WrappedModule;
}

function wrapModuleWithRegistryServer(AppModule: any, options?: NestroServerOptions): any {
  @Module({
    imports: [RegistryModule.register(options), AppModule],
  })
  class WrappedModule {}

  return WrappedModule;
}

export async function createNestroApplication(
  appModule: any,
  clientOptions: NestroApplicationOptions
): Promise<INestroApplication> {
  const wrappedModule = wrapModuleWithRegistry(appModule, clientOptions);

  const app = await NestFactory.create(wrappedModule);

  return {
    ...app,
    listen: () => {
      new Logger().log("Nestro application initial success", "Nestro");
      return app.listen(clientOptions.client.port);
    },
  };
}

export async function createNestroServer(appModule: any, options?: NestroServerOptions): Promise<INestroApplication> {
  const wrappedModule = wrapModuleWithRegistryServer(appModule, options);

  const app = await NestFactory.create(wrappedModule);

  return {
    ...app,
    listen: (port: number) => {
      new Logger().log("Nestro server initial success", "Nestro");
      return app.listen(port);
    },
  };
}
