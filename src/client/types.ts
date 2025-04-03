import { SecurityModuleOptions } from "src/security";
import type { LoadBalancingStrategy, InstanceConfig, ServiceInstance, InstanceOptions } from "../common/types";

export type ClientLoadBalancingOptions = {
  strategy?: LoadBalancingStrategy; // Load balancing strategy, default is round robin
  refreshInterval?: number; // Instance refresh interval
};

export type LoadBalancingRetryOptions = {
  maxRetryCount: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  backoffMultiplier: number;
  resetTimeoutMs: number;
};

export type ServiceInstanceConfig = Pick<InstanceConfig, "port"> &
  Partial<Omit<InstanceConfig, "port">> & { name: string; heartbeatInterval?: number };

export type InstanceInfo = InstanceOptions & { name: string; heartbeatInterval: number };

export type ServerConfig = Pick<InstanceConfig, "host"> & Partial<Omit<InstanceConfig, "host">>;

export type ServerInfo = InstanceOptions;

/**
 * Configuration options for a client service connecting to the registry.
 */
export type ClientServiceConfig = {
  server: ServerConfig; // Registry server configurationq
  client: ServiceInstanceConfig;
};

/**
 * Application-level configuration options, including client settings and security.
 */
export type NestroClientConfig = ClientServiceConfig & {
  security?: SecurityModuleOptions; // Security module configuration
  loadbalancing?: ClientLoadBalancingOptions;
  retryOptions?: LoadBalancingRetryOptions;
};

export type ProxyRouteConfig = {
  route: string;
  target: string;
  middlewares?: any[];
  guards?: any[];
  retryLimit?: number;
  rewritePath?: (path: string) => string;
};

export type ExecuteRequestOptions = {
  retryOnFailure?: boolean;
  maxRetries?: number;
};

export type FailedInstanceInfo = {
  instance: ServiceInstance;
  failedAt: number;
  retryCount: number;
  nextRetryAt: number;
};
