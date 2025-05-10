import { Module, DynamicModule, ValueProvider } from "@nestjs/common";

import { DEFAULT_SERVER_PORT, getHttpSecureProtocol, Service } from "../common";
import type { NestroClientConfig, ServerConfig, ServerInfo } from "./types";
import { INSTANCE_INFO, SERVER_INFO } from "./constants";
import { DiscoveryModule } from "../discovery";
import { SecurityModule } from "../security";
import { ClientService } from "./services";
import { getDefaultHost } from "./utils";

@Module({})
export class ClientModule {
  static register(config: NestroClientConfig): DynamicModule {
    const instanceInfoProvider: ValueProvider<Service> = {
      provide: INSTANCE_INFO,
      useValue: {
        ...config.client,
        host: config.client.host || getDefaultHost(),
        port: config.client.port,
        protocol: getHttpSecureProtocol(config.client.secure),
      },
    };

    const nestroServerInfoProvider: ValueProvider = ClientModule.buildServerConfig(config.server);

    return {
      module: ClientModule,
      imports: [SecurityModule.register(config.security || {}), DiscoveryModule.register(config.loadbalancing || {})],
      providers: [instanceInfoProvider, nestroServerInfoProvider, ClientService],
      exports: [SERVER_INFO, INSTANCE_INFO, DiscoveryModule],
      global: true,
    };
  }

  private static buildServerConfig(config: ServerConfig): ValueProvider {
    if (config instanceof URL) {
      return {
        provide: SERVER_INFO,
        useValue: config,
      } as ValueProvider<URL>;
    }

    return {
      provide: SERVER_INFO,
      useValue: {
        ...config,
        port: config.port || DEFAULT_SERVER_PORT,
        protocol: getHttpSecureProtocol(config.secure),
      } as unknown as ValueProvider<ServerInfo>,
    };
  }
}
