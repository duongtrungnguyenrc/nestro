import { Module, DynamicModule, ValueProvider } from "@nestjs/common";
import * as path from "path";
import os from "os";

import type { KeyServiceOptions, SecurityModuleConfig } from "./types";
import { KEY_SERVICE_OPTIONS } from "./constants";
import { KeyService } from "./services";

@Module({})
export class SecurityModule {
  static register(options?: SecurityModuleConfig): DynamicModule {
    const keyServiceOptionsProvider: ValueProvider<KeyServiceOptions> = {
      provide: KEY_SERVICE_OPTIONS,
      useValue: {
        initKeys: options?.initKeys ?? false,
        privateKeyPath: options?.privateKeyPath?.replace(/^~\//, `${os.homedir()}/`) ?? path.join(__dirname, "private.pem"),
        publicKeyPath: options?.publicKeyPath?.replace(/^~\//, `${os.homedir()}/`) ?? path.join(__dirname, "public.pem"),
      },
    };

    return {
      module: SecurityModule,
      providers: [keyServiceOptionsProvider, KeyService],
      exports: [KeyService],
    };
  }
}
