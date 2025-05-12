import type { NestExpressApplication } from "@nestjs/platform-express";
import { Module, NestApplicationOptions, Type } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import * as path from "path";
import * as hbs from "hbs";

import { registerHandlebarsHelpers } from "./helpers";
import { type NestroApplication } from "../common";
import type { NestroServerConfig } from "./types";
import { ServerModule } from "./server.module";

function wrapModuleWithRegistryServer(AppModule: Type<any>, options?: NestroServerConfig): Type<any> {
  @Module({
    imports: [ServerModule.register(options), AppModule],
  })
  class WrappedModule {}

  return WrappedModule;
}

export async function createNestroServer(
  AppModule: Type<any>,
  options?: NestroServerConfig,
  applicationOptions?: NestApplicationOptions
): Promise<NestroApplication> {
  const wrappedModule = wrapModuleWithRegistryServer(AppModule, options);

  const app = await NestFactory.create<NestExpressApplication>(wrappedModule, applicationOptions);

  if (options?.enableRegistryDashboard) {
    hbs.registerPartials(path.join(__dirname, "..", "..", "resources", "views", "partials"));
    app.useStaticAssets(path.join(__dirname, "..", "..", "resources", "static"));
    app.setBaseViewsDir(path.join(__dirname, "..", "..", "resources", "views"));
    app.setViewEngine("hbs");
    app.set("view options", { layout: "layouts/main" });

    registerHandlebarsHelpers();
  }

  app.enableShutdownHooks();

  return app;
}
