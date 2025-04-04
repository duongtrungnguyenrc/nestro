import type { InstanceConfig, InstanceOptions } from "../common";
import type { LoadBalancingConfigs } from "../loadbalancing";
import type { SecurityModuleConfigs } from "../security";

export type ServiceInstanceConfig = Pick<InstanceConfig, "port"> &
  Partial<Omit<InstanceConfig, "port">> & { name: string };

export type InstanceInfo = InstanceOptions & { name: string };

export type ServerConfig = Pick<InstanceConfig, "host"> & Partial<Omit<InstanceConfig, "host">>;

export type ServerInfo = InstanceOptions;

/**
 * Configuration options for a client service connecting to the registry.
 */
export type ClientServiceConfig = {
  server: ServerConfig; // Registry server configurationq
  client: ServiceInstanceConfig; // Instance configuration
};

/**
 * Application-level configuration options, including client settings and security.
 */
export type NestroClientConfig = ClientServiceConfig & {
  security?: SecurityModuleConfigs; // Security module configuration
  loadbalancing?: LoadBalancingConfigs;
};
