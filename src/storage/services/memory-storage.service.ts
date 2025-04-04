import { Inject } from "@nestjs/common";
import { debugLog, type Service, type ServiceInstance } from "../../common";
import { IRegistryStorage } from "../interfaces";
import type { StorageOptions } from "../types";
import { STORAGE_OPTIONS } from "../constants";

export class MemoryStorage implements IRegistryStorage {
  private memoryStore = new Map<string, Map<string, ServiceInstance>>();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(@Inject(STORAGE_OPTIONS) private readonly options: StorageOptions) {
    this.cleanupInterval = setInterval(() => this.cleanup(), options.cleanupTTL);
    debugLog("RegistryService", "Using in-memory store");
  }

  async register(key: string, instanceId: string, instance: ServiceInstance): Promise<void> {
    let instances = this.memoryStore.get(key);
    if (!instances) {
      instances = new Map();
      this.memoryStore.set(key, instances);
    }
    instances.set(instanceId, instance);
    debugLog("RegistryService", "Registered service in memory", { key, instance });
  }

  async deregister(key: string, instanceId: string): Promise<void> {
    const instances = this.memoryStore.get(key);
    if (!instances) return;

    instances.delete(instanceId);
    if (instances.size === 0) {
      this.memoryStore.delete(key);
    }
    debugLog("RegistryService", "Deregistered service from memory", { key, instanceId });
  }

  async heartbeat(key: string, instanceId: string): Promise<void> {
    const instances = this.memoryStore.get(key);
    if (!instances) return;

    const instance = instances.get(instanceId);
    if (!instance) return;

    instance.timestamp = Date.now();
    instance.expireAt = instance.timestamp + this.options.heartbeatInterval;
    instance.status = "ON";

    debugLog("RegistryService", "Heartbeat updated in memory", { key, instance });
  }

  async getServices(serviceName?: string): Promise<Record<string, ServiceInstance[]>> {
    if (serviceName) {
      return { [serviceName]: Array.from(this.memoryStore.get(serviceName)?.values() || []) };
    }

    const result: Record<string, ServiceInstance[]> = {};
    this.memoryStore.forEach((instances, name) => {
      result[name] = Array.from(instances.values());
    });

    return result;
  }

  cleanup(): void {
    const now = Date.now();

    for (const [key, instances] of this.memoryStore.entries()) {
      instances.forEach((instance, id) => {
        if (now > instance.expireAt) {
          instances.delete(id);
          debugLog("RegistryService", "Removed expired service", { key, instance });
        } else if (now - instance.timestamp > this.options.heartbeatInterval) {
          instance.status = "OFF";
        }
      });

      if (instances.size === 0) {
        this.memoryStore.delete(key);
        debugLog("RegistryService", "Removed empty service set", { key });
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      debugLog("RegistryService", "Stopped cleanup interval");
    }
  }

  getInstanceId(instance: Service | ServiceInstance): string {
    return `${instance.name}:${instance.host}:${instance.port}`;
  }
}
