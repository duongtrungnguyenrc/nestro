import type { Service } from "../common";

/**
 * Configuration options for the storage system.
 *
 * @property {number} [heartbeatInterval] - Optional interval (in milliseconds) for sending heartbeat signals.
 * @property {number} [cleanupTTL] - Optional time-to-live (in milliseconds) for cleaning up expired items.
 * @property {number} [evictionThreshold] - Optional threshold for triggering eviction of items from storage.
 */
export type StorageOptions = {
  heartbeatInterval?: number;
  cleanupTTL?: number;
  evictionThreshold?: number;
};

/**
 * Represents a partial configuration for storage options.
 *
 * This type allows specifying only a subset of the properties
 * defined in `StorageOptions`, making it flexible for use cases
 * where not all options need to be provided.
 */
export type StorageConfigs = Partial<StorageOptions>;

/**
 * Represents an instance of a service with additional metadata.
 *
 * @extends Service
 *
 * @property {InstanceStatus} status - The current status of the service instance.
 * @property {number} timestamp - The timestamp indicating when the instance was created or updated.
 * @property {number} lastHeartbeatAt - The timestamp of the last received heartbeat from the instance.
 * @property {number} missedHeartbeats - The number of consecutive heartbeats missed by the instance.
 */
export type ServiceInstance = Service & {
  timestamp: number;
  lastHeartbeatAt: number;
  missedHeartbeats: number;
};
