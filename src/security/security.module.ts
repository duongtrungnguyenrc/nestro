import { Module, DynamicModule, Provider } from "@nestjs/common";
import * as path from "path";
import os from "os";

import type { SecurityModuleOptions } from "./types";
import { KeyService } from "./services";

@Module({})
export class SecurityModule {
  static register(options?: SecurityModuleOptions): DynamicModule {
    const keyServiceProvider: Provider = {
      provide: KeyService,
      useFactory: () => {
        return new KeyService({
          initKeys: options?.initKeys ?? false,
          privateKeyPath:
            options?.privateKeyPath?.replace(/^~\//, `${os.homedir()}/`) ?? path.join(__dirname, "private.key"),
          publicKeyPath:
            options?.publicKeyPath?.replace(/^~\//, `${os.homedir()}/`) ?? path.join(__dirname, "public.key"),
        });
      },
    };

    return {
      module: SecurityModule,
      providers: [keyServiceProvider],
      exports: [KeyService],
    };
  }
}
