import type { NestExpressApplication } from "@nestjs/platform-express";
import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import * as path from "path";
import * as hbs from "hbs";

import { debugLog, type NestroApplication } from "../common";
import type { NestroServerConfig } from "./types";
import { ServerModule } from "./server.module";
import { registerHandlebarsHelpers } from "./helpers";

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
    hbs.registerPartials(path.join(__dirname, "..", "..", "resources", "views", "partials"));
    app.useStaticAssets(path.join(__dirname, "..", "..", "resources", "static"));
    app.setBaseViewsDir(path.join(__dirname, "..", "..", "resources", "views"));
    app.setViewEngine("hbs");
    app.set("view options", { layout: "layouts/main" });

    registerHandlebarsHelpers();
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
