import { Module, DynamicModule, ValueProvider } from "@nestjs/common";

import { DEFAULT_HOST, DEFAULT_SERVER_PORT, getHttpSecureProtocol, type ServiceInstance } from "../common";
import type { NestroClientConfig, ServerInfo, InstanceInfo } from "./types";
import { INSTANCE_INFO, INSTANCES, SERVER_INFO } from "./constants";
import { DiscoveryModule } from "../discovery";
import { SecurityModule } from "../security";
import { ClientService } from "./services";

@Module({})
export class ClientModule {
  static register(config: NestroClientConfig): DynamicModule {
    const instanceOptionsProvider: ValueProvider<InstanceInfo> = {
      provide: INSTANCE_INFO,
      useValue: {
        ...config.client,
        host: config.client.host || DEFAULT_HOST,
        protocol: getHttpSecureProtocol(config.server.secure),
      },
    };

    const nestroServerOptionsProvider: ValueProvider<ServerInfo> = {
      provide: SERVER_INFO,
      useValue: {
        ...config.server,
        port: config.server.port || DEFAULT_SERVER_PORT,
        protocol: getHttpSecureProtocol(config.server.secure),
      },
    };

    const instancesProvider: ValueProvider<Record<string, ServiceInstance[]>> = {
      provide: INSTANCES,
      useValue: {},
    };

    return {
      module: ClientModule,
      imports: [SecurityModule.register(config.security || {}), DiscoveryModule.register(config.loadbalancing || {})],
      providers: [instanceOptionsProvider, nestroServerOptionsProvider, instancesProvider, ClientService],
      exports: [SERVER_INFO, INSTANCE_INFO, DiscoveryModule],
      global: true,
    };
  }
}
