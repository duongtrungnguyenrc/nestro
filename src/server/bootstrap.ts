import type { NestExpressApplication } from "@nestjs/platform-express";
import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { registerPartials } from "hbs";
import { join } from "path";

import { debugLog, type NestroApplication } from "../common";
import type { NestroServerConfig } from "./types";
import { ServerModule } from "./server.module";

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
    app.useStaticAssets(join(__dirname, "..", "..", "resources", "static", "static"));
    app.setBaseViewsDir(join(__dirname, "..", "..", "resources", "views", "pages"));
    app.setViewEngine("hbs");

    registerPartials(join(__dirname, "..", "..", "resources", "views", "partials"));
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
