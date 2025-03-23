import type { NestExpressApplication } from "@nestjs/platform-express";
import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { join } from "path";
import * as hbs from "hbs";

import type { INestroApplication, NestroApplicationOptions, NestroServerOptions } from "./types";
import { RegistryModule } from "./registry";
import { ClientModule } from "./client";
import { debugLog } from "./utils";

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
  AppModule: any,
  clientOptions: NestroApplicationOptions
): Promise<INestroApplication> {
  const wrappedModule = wrapModuleWithRegistry(AppModule, clientOptions);

  const app = await NestFactory.create<NestExpressApplication>(wrappedModule);

  return {
    ...app,
    listen: async () => {
      debugLog("Nestro application initial success", "Nestro");
      await app.listen(clientOptions.client.port);
    },
  };
}

export async function createNestroServer(appModule: any, options?: NestroServerOptions): Promise<INestroApplication> {
  const wrappedModule = wrapModuleWithRegistryServer(appModule, options);

  const app = await NestFactory.create<NestExpressApplication>(wrappedModule);

  app.useStaticAssets(join(__dirname, "..", "public"));
  app.setBaseViewsDir(join(__dirname, "..", "views"));
  app.setViewEngine("hbs");

  hbs.registerPartials(join(__dirname, "..", "views/partials"));

  return {
    ...app,
    listen: async (port: number) => {
      debugLog("Nestro server initial success", "Nestro");
      await app.listen(port);
    },
  };
}
