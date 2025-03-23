import type { INestApplication } from "@nestjs/common";

import { RegistryServiceOptions } from "./registry";
import { SecurityModuleOptions } from "./security";
import { ClientServiceOptions } from "./client";

export type NestroApplicationOptions = ClientServiceOptions & {
  security?: SecurityModuleOptions;
};

export type INestroApplication = INestApplication & {
  listen: (port?: number) => Promise<void>;
};

export type NestroServerOptions = Partial<
  {
    publicKeyPath: string;
    privateKeyPath: string;
  } & RegistryServiceOptions
>;
