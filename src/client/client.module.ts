import { Module, DynamicModule, ValueProvider, Type, Provider, NestModule, MiddlewareConsumer } from "@nestjs/common";

import { GatewaySwaggerMiddleware, SwaggerAssetsMiddleware, SwaggerInitMiddleware } from "./middlewares";
import { CLIENT_SERVICE, GATEWAY_OPTIONS, INSTANCE_INFO, SERVER_INFO } from "./constants";
import type { NestroClientConfig, ServerConfig, ServerInfo } from "./types";
import { DEFAULT_SERVER_PORT, getHttpSecureProtocol } from "../common";
import { PlainClientService, SecureClientService } from "./services";
import { DiscoveryModule } from "../discovery";
import { SecurityModule } from "../security";
import { getDefaultHost } from "./utils";

@Module({})
export class ClientModule implements NestModule {
  private static _swaggerEndpoint: string;

  static register(config: NestroClientConfig): DynamicModule {
    if (config.gateway?.swagger?.path) {
      ClientModule._swaggerEndpoint = config.gateway.swagger.path;
    }

    const imports: Array<Type<any> | DynamicModule> = [DiscoveryModule.register(config.loadbalancing || {})];
    const providers: Array<Provider> = [
      {
        provide: INSTANCE_INFO,
        useValue: {
          ...config.client,
          host: config.client.host || getDefaultHost(),
          port: config.client.port,
          protocol: getHttpSecureProtocol(config.client.secure),
          status: "ON",
        },
      },
      ClientModule.buildServerConfig(config.server),
    ];

    if (config.gateway) {
      providers.push({
        provide: GATEWAY_OPTIONS,
        useValue: config.gateway,
      });
    }

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

  configure(consumer: MiddlewareConsumer) {
    if (ClientModule._swaggerEndpoint) {
      consumer.apply(SwaggerInitMiddleware, SwaggerAssetsMiddleware, GatewaySwaggerMiddleware).forRoutes(ClientModule._swaggerEndpoint);
    }
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
