import { SecurityModuleConfig } from "../security";
import { StorageConfigs } from "../storage";

/**
 * Configuration options for the Nestro server.
 *
 * This type allows partial customization of the server's behavior
 * by specifying configurations for various modules and features.
 *
 * @property security - Configuration options for the security module.
 * @property storage - Configuration options for the storage module.
 * @property enableRegistryDashboard - Optional flag to enable or disable the registry dashboard.
 * @property enableSecurity - Optional flag to enable or disable security features.
 */
export type NestroServerConfig = Partial<{
  security: SecurityModuleConfig;
  storage: StorageConfigs;
  enableRegistryDashboard: boolean;
  enableSecurity: boolean;
}>;

/**
 * Represents the response received upon successful registration.
 *
 * @property heartbeatInterval - The interval (in milliseconds) at which
 * heartbeat signals should be sent to maintain the connection.
 */
export type RegisterResponse = {
  heartbeatInterval: number;
};
