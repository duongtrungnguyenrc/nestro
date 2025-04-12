import { Inject, OnModuleInit } from "@nestjs/common";

import { debugLog, type Service, type ServiceInstance } from "../../common";
import { IRegistryStorage } from "../interfaces";
import type { StorageOptions } from "../types";
import { STORAGE_OPTIONS } from "../constants";

export class MemoryStorage implements IRegistryStorage, OnModuleInit {
  private memoryStore = new Map<string, Map<string, ServiceInstance>>();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(@Inject(STORAGE_OPTIONS) private readonly options: StorageOptions) {}

  onModuleInit() {
    this.cleanupInterval = setInterval(() => this.cleanup(), this.options.cleanupTTL);
    debugLog("RegistryService", "Using in-memory store");
  }

  async register(key: string, instance: Service): Promise<void> {
    const now = Date.now();
    const instances = this.getOrCreateInstances(key);
    const instanceId = this.getInstanceId(instance);

    instances.set(instanceId, {
      ...instance,
      status: "ON",
      timestamp: now,
      lastHeartbeatAt: now,
      missedHeartbeats: 0,
    });

    debugLog("RegistryService", "Registered service in memory", { key, instanceId });
  }

  async heartbeat(key: string, instance: Service): Promise<void> {
    const now = Date.now();
    const instances = this.getOrCreateInstances(key);
    const instanceId = this.getInstanceId(instance);
    const existingInstance = instances.get(instanceId);

    if (!existingInstance) {
      // Auto register on heartbeat (optional)
      await this.register(key, instance);
      debugLog("RegistryService", "Recovered missing instance via heartbeat", { key, instanceId });
      return;
    }

    existingInstance.lastHeartbeatAt = now;
    existingInstance.missedHeartbeats = 0;
    existingInstance.status = "ON";

    debugLog("RegistryService", "Heartbeat received", { key, instanceId });
  }

  async deregister(key: string, instance: Service): Promise<void> {
    const instances = this.memoryStore.get(key);
    if (!instances) return;

    const instanceId = this.getInstanceId(instance);
    instances.delete(instanceId);

    if (instances.size === 0) {
      this.memoryStore.delete(key);
    }

    debugLog("RegistryService", "Deregistered service from memory", { key, instanceId });
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
    const heartbeatThreshold = this.options.heartbeatInterval;

    for (const [key, instances] of this.memoryStore.entries()) {
      for (const [id, instance] of instances.entries()) {
        const missedDuration = now - instance.lastHeartbeatAt;

        if (missedDuration > heartbeatThreshold) {
          instance.missedHeartbeats += 1;

          if (instance.missedHeartbeats >= this.options.evictionThreshold) {
            instances.delete(id);
            debugLog("RegistryService", "Evicted service after missed heartbeats", { key, id });
            continue;
          }

          instance.status = "OFF";
        } else {
          instance.status = "ON";
          instance.missedHeartbeats = 0;
        }
      }

      if (instances.size === 0) {
        this.memoryStore.delete(key);
        debugLog("RegistryService", "Removed empty service set", { key });
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
      debugLog("RegistryService", "Stopped cleanup interval");
    }
  }

  getInstanceId(instance: Service): string {
    return `${instance.name}:${instance.host}:${instance.port}`;
  }

  private getOrCreateInstances(key: string): Map<string, ServiceInstance> {
    let instances = this.memoryStore.get(key);
    if (!instances) {
      instances = new Map();
      this.memoryStore.set(key, instances);
    }
    return instances;
  }
}
