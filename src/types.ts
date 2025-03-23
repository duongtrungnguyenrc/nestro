import type { NestExpressApplication } from "@nestjs/platform-express";

import { RegistryServiceOptions } from "./registry";
import { SecurityModuleOptions } from "./security";
import { ClientServiceOptions } from "./client";

export type NestroApplicationOptions = ClientServiceOptions & {
  security?: SecurityModuleOptions;
};

export type INestroApplication = Omit<NestExpressApplication, "listen"> & {
  listen: (port?: number) => Promise<void>;
};

export type NestroServerOptions = Partial<
  {
    publicKeyPath: string;
    privateKeyPath: string;
    enableServiceDiscovery?: boolean;
  } & RegistryServiceOptions
>;
