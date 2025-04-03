import type { NestExpressApplication } from "@nestjs/platform-express";
import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";

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

export async function createNestroApplication(AppModule: any, config: NestroClientConfig): Promise<NestroApplication> {
  const wrappedModule = wrapModuleWithRegistry(AppModule, config);

  const app = await NestFactory.create<NestExpressApplication>(wrappedModule);

  return {
    ...app,
    listen: async () => {
      debugLog("Nestro application initial success", "Nestro");
      return await app.listen(config.client.port);
    },
  };
}
