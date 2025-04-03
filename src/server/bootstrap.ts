import type { NestExpressApplication } from "@nestjs/platform-express";
import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { join } from "path";
import * as hbs from "hbs";

import { ServerModule } from "./server.module";
import { debugLog, type NestroApplication } from "src/common";
import type { NestroServerConfig } from "./types";

function wrapModuleWithRegistryServer(AppModule: any, options?: NestroServerConfig): any {
  @Module({
    imports: [ServerModule.register(options), AppModule],
  })
  class WrappedModule {}

  return WrappedModule;
}

export async function createNestroServer(AppModule: any, options?: NestroServerConfig): Promise<NestroApplication> {
  const wrappedModule = wrapModuleWithRegistryServer(AppModule, options);

  const app = await NestFactory.create<NestExpressApplication>(wrappedModule);

  if (options.enableRegistryDashboard) {
    app.useStaticAssets(join(__dirname, "..", "public"));
    app.setBaseViewsDir(join(__dirname, "..", "views"));
    app.setViewEngine("hbs");

    hbs.registerPartials(join(__dirname, "..", "views/partials"));
  }

  return {
    ...app,
    listen: async (port: number) => {
      const server = await app.listen(port);
      debugLog("Nestro server", "Nestro server initial success");

      return server;
    },
  };
}
