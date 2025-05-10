import { Service } from "../../common";

export interface IRegistryStorage {
  /**
   * Registers a new service instance under the given key (usually the service name).
   * If the instance already exists, it should be updated or replaced.
   */
  register(key: string, instance: Service): Promise<void>;

  /**
   * Removes a service instance from the registry.
   */
  deregister(key: string, instance: Service): Promise<void>;

  /**
   * Updates the heartbeat timestamp of a registered service instance.
   * If the instance does not exist, it can optionally be auto-registered.
   */
  heartbeat(key: string, instance: Service): Promise<void>;

  /**
   * Retrieves all registered service instances.
   * If a specific service name is provided, only return instances of that service.
   */
  getServices(serviceName?: string): Promise<Record<string, Service[]>>;

  /**
   * Generates a unique ID for a given service instance,
   * typically based on host, port, and service name.
   */
  getInstanceId(instance: Service): string;

  /**
   * Performs cleanup of expired or unreachable instances.
   * This method is optional and mostly relevant for in-memory or timed eviction stores.
   */
  cleanup?(): void | Promise<void>;

  /**
   * Gracefully closes any connections or timers if the storage is being shut down.
   */
  disconnect?(): Promise<void>;

  /**
   * Optionally checks if a specific instance exists.
   * Useful for avoiding unnecessary overwrites in some storage implementations.
   */
  exists?(key: string, instance: Service): Promise<boolean>;

  /**
   * Optionally retrieves a single instance by its ID.
   * Useful when status or metadata needs to be fetched individually.
   */
  getInstance?(key: string, instanceId: string): Promise<Service | undefined>;
}
