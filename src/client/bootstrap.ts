import type { NestExpressApplication } from "@nestjs/platform-express";
import { Module, NestApplicationOptions, Type } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { debugLog, type NestroApplication } from "../common";
import type { NestroClientConfig } from "./types";
import { ClientModule } from "./client.module";
import { getFreePort } from "./utils";

function wrapModuleWithRegistry(AppModule: Type<any>, config: NestroClientConfig): Type<any> {
  @Module({
    imports: [ClientModule.register(config), AppModule],
  })
  class WrappedModule {}

  return WrappedModule;
}

export async function createNestroApplication(
  AppModule: Type<any>,
  config: NestroClientConfig,
  applicationOptions?: NestApplicationOptions
): Promise<NestroApplication> {
  const clientConfig: NestroClientConfig = {
    ...config,
    client: {
      ...config.client,
      port: config.client.port || (await getFreePort()),
    },
  };

  const wrappedModule = wrapModuleWithRegistry(AppModule, clientConfig);

  const app = await NestFactory.create<NestExpressApplication>(wrappedModule, applicationOptions);

  const nestroApp: NestroApplication = Object.create(Object.getPrototypeOf(app), Object.getOwnPropertyDescriptors(app));

  nestroApp.enableShutdownHooks();

  nestroApp.listen = async () => {
    const server = await app.listen(clientConfig.client.port);
    debugLog("Nestro", "Nestro application initial success");

    return server;
  };

  return nestroApp;
}
