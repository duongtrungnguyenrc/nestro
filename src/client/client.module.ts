import { Module, DynamicModule, ValueProvider, Type, Provider } from "@nestjs/common";

import { DEFAULT_SERVER_PORT, getHttpSecureProtocol, Service } from "../common";
import type { NestroClientConfig, ServerConfig, ServerInfo } from "./types";
import { CLIENT_SERVICE, INSTANCE_INFO, SERVER_INFO } from "./constants";
import { PlainClientService, SecureClientService } from "./services";
import { DiscoveryModule } from "../discovery";
import { SecurityModule } from "../security";
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
        status: "ON",
      },
    };

    const nestroServerInfoProvider: ValueProvider = ClientModule.buildServerConfig(config.server);

    const imports: Array<Type<any> | DynamicModule> = [DiscoveryModule.register(config.loadbalancing || {})];
    const providers: Array<Provider> = [instanceInfoProvider, nestroServerInfoProvider];

    if (config.enableSecurity) {
      imports.push(SecurityModule.register(config.security || {}));
      providers.push({
        provide: CLIENT_SERVICE,
        useClass: SecureClientService,
      });
    } else {
      providers.push({
        provide: CLIENT_SERVICE,
        useClass: PlainClientService,
      });
    }

    return {
      module: ClientModule,
      imports: imports,
      providers: providers,
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
