import type { ServiceConfig, HttpProtocols } from "../common";
import type { LoadBalancingConfigs } from "../discovery";
import type { SecurityModuleConfigs } from "../security";

/**
 * Represents the configuration for a server.
 *
 * This type is derived from `ServiceConfig` by including the `host` property
 * and making all other properties optional.
 *
 * - `host`: The host address of the server (required).
 * - Other properties from `ServiceConfig` are optional.
 *
 * @see ServiceConfig
 */
export type ServerConfig =
  | {
      host?: string;
      port?: number;
      secure?: boolean;
    }
  | URL;

/**
 * Represents the information required to connect to a server.
 *
 * @property host - The hostname or IP address of the server (optional).
 * @property port - The port number on which the server is running (optional).
 * @property protocol - The HTTP protocol used by the server (e.g., HTTP or HTTPS) (optional).
 */
export type ServerInfo = {
  host?: string;
  port?: number;
  protocol?: HttpProtocols;
};

/**
 * Configuration for a client service, including server and instance details.
 *
 * @property server - Configuration for the registry server.
 * @property client - Configuration for the service instance.
 */
export type ClientServiceConfig = {
  server: ServerConfig; // Registry server configurationq
  client: ServiceConfig; // Instance configuration
};

/**
 * Configuration options for the Nestro client.
 *
 * This type extends the `ClientServiceConfig` and includes additional
 * optional configurations for security and load balancing.
 *
 * @property security - Optional configuration for the security module.
 * @property loadbalancing - Optional configuration for load balancing.
 */
export type NestroClientConfig = ClientServiceConfig & {
  security?: SecurityModuleConfigs; // Security module configuration
  loadbalancing?: LoadBalancingConfigs;
};
