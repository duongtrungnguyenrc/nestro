import { Module, DynamicModule, NestModule, MiddlewareConsumer, RequestMethod, Provider } from "@nestjs/common";

import { SecurityModule, SecurityMiddleware } from "../security";
import type { NestroServerOptions } from "../types";
import { RegistryController } from "./controllers";
import { DEFAULT_CLEANUP_TTL } from "./constants";
import { RegistryService } from "./services";

@Module({})
export class RegistryModule implements NestModule {
  static register(options?: NestroServerOptions): DynamicModule {
    const registryServiceProvider: Provider = {
      provide: RegistryService,
      useFactory: () => {
        return new RegistryService({
          cleanupTTL: options?.cleanupTTL ?? DEFAULT_CLEANUP_TTL,
          loadBalancingStrategy: options.loadBalancingStrategy ?? "least-connections",
        });
      },
    };

    return {
      module: RegistryModule,
      imports: [
        SecurityModule.register({
          ...(options ?? {}),
          initKeys: true,
        }),
      ],
      controllers: [RegistryController],
      providers: [registryServiceProvider],
      exports: [RegistryService],
      global: true,
    };
  }

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityMiddleware)
      .exclude({ path: "/nestro/services", method: RequestMethod.GET })
      .forRoutes("/nestro/*");
  }
}
