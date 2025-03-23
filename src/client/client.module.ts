import { Module, DynamicModule, Provider } from "@nestjs/common";

import { SecurityModule, KeyService } from "../security";
import { NestroApplicationOptions } from "../types";
import { ClientService } from "./services";

@Module({})
export class ClientModule {
  static register(options: NestroApplicationOptions): DynamicModule {
    const clientServiceProvider: Provider = {
      provide: ClientService,
      useFactory: (keyService: KeyService) => {
        return new ClientService(
          {
            ...options,
            client: {
              ...options.client,
              protocol: options.client.protocol ?? "http",
            },
            nestro: {
              ...options.nestro,
              protocol: options.client.protocol ?? "http",
            },
            heartbeatInterval: options.heartbeatInterval ?? 10000,
          },
          keyService
        );
      },
      inject: [KeyService],
    };

    return {
      module: ClientModule,
      imports: [SecurityModule.register(options.security)],
      providers: [clientServiceProvider],
      exports: [ClientService],
    };
  }
}
