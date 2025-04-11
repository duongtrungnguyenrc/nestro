import { SecurityModuleConfigs } from "../security";
import { StorageConfigs } from "../storage";

/**
 * Configuration options for the Nestro server.
 *
 * @template SecurityModuleConfigs - Defines the security-related configurations for the server.
 * @template StorageConfigs - Specifies the storage-related configurations.
 *
 * @property {SecurityModuleConfigs} [security] - Security options for the server.
 * @property {StorageConfigs} [storage] - Storage configurations for the server.
 * @property {boolean} [enableRegistryDashboard] - Enables a web dashboard for service monitoring.
 */
export type NestroServerConfig = Partial<{
  security: SecurityModuleConfigs;
  storage: StorageConfigs;
  enableRegistryDashboard: boolean;
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
