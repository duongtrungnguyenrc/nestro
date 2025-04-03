import { debugLog, type Service, type ServiceInstance } from "../../common";
import type { RegistryServiceOptions } from "../../types";
import { IRegistryStorage } from "../interfaces";

export class MemoryStorage implements IRegistryStorage {
  private memoryStore = new Map<string, Map<string, ServiceInstance>>();
  private requestCounts = new Map<string, Map<string, number>>();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(private readonly options: Pick<RegistryServiceOptions, "heartbeatInterval" | "cleanupTTL">) {
    this.cleanupInterval = setInterval(() => this.cleanup(), 5000);
    debugLog("RegistryService", "Using in-memory store");
  }

  async register(key: string, instanceId: string, instance: ServiceInstance): Promise<void> {
    if (!this.memoryStore.has(key)) {
      this.memoryStore.set(key, new Map());
    }
    this.memoryStore.get(key)!.set(instanceId, instance);
    debugLog("RegistryService", "Registered service in memory", { key, instance });
  }

  async deregister(key: string, instanceId: string): Promise<void> {
    this.memoryStore.get(key)?.delete(instanceId);
    if (this.memoryStore.get(key)?.size === 0) {
      this.memoryStore.delete(key);
    }
    debugLog("RegistryService", "Deregistered service from memory", { key, instanceId });
  }

  async heartbeat(key: string, instanceId: string): Promise<void> {
    const instance = this.memoryStore.get(key)?.get(instanceId);
    if (instance) {
      instance.expireAt = Date.now() + this.options.cleanupTTL * 1000;
      instance.timestamp = Date.now();
      instance.status = "ON";
      debugLog("RegistryService", "Heartbeat updated in memory", { key, instance });
    }
  }

  async getServices(serviceName?: string): Promise<Record<string, ServiceInstance[]>> {
    const result: Record<string, ServiceInstance[]> = {};

    if (serviceName) {
      const instances = Array.from(this.memoryStore.get(serviceName)?.values() || []);
      const requestCountMap = this.requestCounts.get(serviceName) || new Map();

      result[serviceName] = instances.map((instance) => {
        const instanceId = this.getInstanceId(instance);
        return {
          ...instance,
          requestCount: requestCountMap.get(instanceId) || 0,
        };
      });
    } else {
      for (const [name, instances] of this.memoryStore.entries()) {
        const requestCountMap = this.requestCounts.get(name) || new Map();
        result[name] = Array.from(instances.values()).map((instance) => {
          const instanceId = this.getInstanceId(instance);
          return {
            ...instance,
            requestCount: requestCountMap.get(instanceId) || 0,
          };
        });
      }
    }

    return result;
  }

  async incrementRequestCount(serviceName: string, instanceId: string): Promise<void> {
    if (!this.requestCounts.has(serviceName)) {
      this.requestCounts.set(serviceName, new Map());
    }
    const serviceRequests = this.requestCounts.get(serviceName)!;
    const currentCount = serviceRequests.get(instanceId) || 0;
    serviceRequests.set(instanceId, currentCount + 1);
    debugLog("RegistryService", "Incremented request count in memory", {
      serviceName,
      instanceId,
      count: currentCount + 1,
    });
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, instances] of this.memoryStore.entries()) {
      for (const [id, instance] of instances.entries()) {
        if (now - instance.timestamp > this.options.heartbeatInterval * 1000) {
          instance.status = "OFF";
        }
        if (now > instance.expireAt!) {
          instances.delete(id);
          debugLog("RegistryService", "Removed expired service", { key, instance });
        }
      }
      if (instances.size === 0) {
        this.memoryStore.delete(key);
        debugLog("RegistryService", "Removed empty service set", { key });
      }
    }
  }

  disconnect(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      debugLog("RegistryService", "Stopped cleanup interval");
    }
    return Promise.resolve();
  }

  private getInstanceId(instance: Service | ServiceInstance): string {
    return `${instance.host}:${instance.port}`;
  }
}
