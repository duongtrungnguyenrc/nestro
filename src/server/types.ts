import { SecurityModuleConfigs } from "../security";
import { StorageConfigs } from "../storage";

/**
 * Server configuration options, extending registry options.
 */
export type NestroServerConfig = Partial<{
  security: SecurityModuleConfigs; // Security options for the server
  storage: StorageConfigs;
  enableRegistryDashboard: boolean; // Enables a web dashboard for service monitoring
}>;

export type RegisterResponse = {
  heartbeatInterval: number; // Interval for sending heartbeat signals
};
