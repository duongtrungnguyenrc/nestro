import { ServiceInstance } from "@nestro/core";

export interface IRegistryStorage {
  register(key: string, instanceId: string, instance: ServiceInstance): Promise<void>;
  deregister(key: string, instanceId: string): Promise<void>;
  heartbeat(key: string, instanceId: string, ttl: number): Promise<void>;
  getServices(serviceName?: string): Promise<Record<string, ServiceInstance[]>>;
  incrementRequestCount(serviceName: string, instanceId: string): Promise<void>;
  cleanup?(): void;
  disconnect?(): Promise<void>;
}
