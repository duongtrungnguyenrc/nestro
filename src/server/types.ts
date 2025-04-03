import { LoadBalancingStrategy } from "../common";

/**
 * Server configuration options, extending registry options.
 */
export type NestroServerConfig = Partial<
  RegistryServiceOptions & {
    publicKeyPath: string; // Path to the public key for security
    privateKeyPath: string; // Path to the private key for security
    enableRegistryDashboard?: boolean; // Enables a web dashboard for service monitoring
  }
>;

/**
 * Configuration options for the service registry.
 */
export type RegistryServiceOptions = {
  strategy?: LoadBalancingStrategy; // Load balancing strategy
  heartbeatInterval?: number; // Interval for sending heartbeat signals (optional)
  cleanupTTL?: number; // Time-to-live for service cleanup in milliseconds
};
