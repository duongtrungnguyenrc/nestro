import type { InstanceConfig, InstanceOptions } from "../common";
import type { LoadBalancingConfigs } from "../loadbalancing";
import type { SecurityModuleConfigs } from "../security";

/**
 * Represents the configuration for a service instance.
 * 
 * This type is constructed by combining the following:
 * - The `port` property from `InstanceConfig` (required).
 * - All other properties from `InstanceConfig` as optional.
 * - An additional `name` property (required).
 * 
 * @template InstanceConfig - The base configuration type from which properties are derived.
 * 
 * @property {number} port - The port number on which the service instance operates (required).
 * @property {string} name - The name of the service instance (required).
 * @property {Partial<Omit<InstanceConfig, "port">>} [otherProperties] - Any other optional properties from `InstanceConfig`, excluding `port`.
 */
export type ServiceInstanceConfig = Pick<InstanceConfig, "port"> &
  Partial<Omit<InstanceConfig, "port">> & { name: string };

/**
 * Represents detailed information about an instance, combining instance options
 * with a required name property.
 *
 * @extends InstanceOptions
 * @property {string} name - The unique name of the instance.
 */
export type InstanceInfo = InstanceOptions & { name: string };

/**
 * Represents the configuration for a server.
 * 
 * This type is derived from `InstanceConfig` by including the `host` property
 * and making all other properties optional.
 * 
 * - `host`: The host address of the server (required).
 * - Other properties from `InstanceConfig` are optional.
 * 
 * @see InstanceConfig
 */
export type ServerConfig = Pick<InstanceConfig, "host"> & Partial<Omit<InstanceConfig, "host">>;

/**
 * Represents the server information, which is defined by the `InstanceOptions` type.
 */
export type ServerInfo = InstanceOptions;


/**
 * Configuration for a client service, including server and instance details.
 *
 * @property server - Configuration for the registry server.
 * @property client - Configuration for the service instance.
 */
export type ClientServiceConfig = {
  server: ServerConfig; // Registry server configurationq
  client: ServiceInstanceConfig; // Instance configuration
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
