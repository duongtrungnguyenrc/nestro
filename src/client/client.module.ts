import { Module, DynamicModule, ValueProvider } from "@nestjs/common";

import type {
  ClientLoadBalancingOptions,
  LoadBalancingRetryOptions,
  NestroClientConfig,
  ServerInfo,
  InstanceInfo,
} from "./types";
import {
  CLIENT_LOADBALANCING_OPTION,
  INSTANCE_INFO,
  DEFAULT_HEARBEAT_INTERVAL,
  DEFAULT_LOAD_BALANCING_REFRESH_INTERVAL,
  DEFAULT_LOAD_BALANCING_STRATEGY,
  DEFAULT_RETRY_OPTIONS,
  DEFAULT_SERVER_PORT,
  INSTANCES,
  RETRY_OPTIONS,
  SERVER_INFO,
  DEFAULT_HOST,
} from "./constants";
import { ClientLoadBalancerService, ClientService } from "./services";
import { getSecureProtocol, type ServiceInstance } from "../common";
import { SecurityModule } from "../security";

@Module({})
export class ClientModule {
  static register(config: NestroClientConfig): DynamicModule {
    const instanceOptionsProvider: ValueProvider<InstanceInfo> = {
      provide: INSTANCE_INFO,
      useValue: {
        ...config.client,
        host: config.client.host || DEFAULT_HOST,
        protocol: getSecureProtocol(config.server.secure),
        heartbeatInterval: config.client.heartbeatInterval || DEFAULT_HEARBEAT_INTERVAL,
      },
    };

    const nestroServerOptionsProvider: ValueProvider<ServerInfo> = {
      provide: SERVER_INFO,
      useValue: {
        ...config.server,
        port: config.server.port || DEFAULT_SERVER_PORT,
        protocol: getSecureProtocol(config.server.secure),
      },
    };

    const loadBalancingOptionsProvider: ValueProvider<ClientLoadBalancingOptions> = {
      provide: CLIENT_LOADBALANCING_OPTION,
      useValue: {
        ...config.loadbalancing,
        strategy: config.loadbalancing.strategy || DEFAULT_LOAD_BALANCING_STRATEGY,
        refreshInterval: config.loadbalancing.refreshInterval || DEFAULT_LOAD_BALANCING_REFRESH_INTERVAL,
      },
    };

    const retryOptionsProvider: ValueProvider<LoadBalancingRetryOptions> = {
      provide: RETRY_OPTIONS,
      useValue: {
        ...DEFAULT_RETRY_OPTIONS,
        ...config.retryOptions,
      },
    };

    const instancesProvider: ValueProvider<Record<string, ServiceInstance[]>> = {
      provide: INSTANCES,
      useValue: {},
    };

    return {
      module: ClientModule,
      imports: [SecurityModule.register(config.security)],
      providers: [
        instanceOptionsProvider,
        nestroServerOptionsProvider,
        loadBalancingOptionsProvider,
        retryOptionsProvider,
        instancesProvider,
        ClientLoadBalancerService,
        ClientService,
      ],
      exports: [ClientLoadBalancerService],
      global: true,
    };
  }
}
