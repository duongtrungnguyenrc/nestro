import type { NestExpressApplication } from "@nestjs/platform-express";
import { Module, NestApplicationOptions } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { debugLog, type NestroApplication } from "../common";
import type { NestroClientConfig } from "./types";
import { ClientModule } from "./client.module";

function wrapModuleWithRegistry(AppModule: any, config: NestroClientConfig): any {
  @Module({
    imports: [ClientModule.register(config), AppModule],
  })
  class WrappedModule {}

  return WrappedModule;
}

export async function createNestroApplication(
  AppModule: any,
  config: NestroClientConfig,
  applicationOptions?: NestApplicationOptions
): Promise<NestroApplication> {
  const wrappedModule = wrapModuleWithRegistry(AppModule, config);

  const app = await NestFactory.create<NestExpressApplication>(wrappedModule, applicationOptions);

  const nestroApp: NestroApplication = Object.create(Object.getPrototypeOf(app), Object.getOwnPropertyDescriptors(app));

  nestroApp.enableShutdownHooks();

  nestroApp.listen = async () => {
    const server = await app.listen(config.client.port);
    debugLog("Nestro", "Nestro application initial success");

    return server;
  };

  return nestroApp;
}
