import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { createClient, RedisClientType } from "redis";

import type { RegistryServiceOptions, ServiceInstance } from "../types";
import { ServiceDto } from "../../global-types";
import { debugLog } from "../../utils";

@Injectable()
export class RegistryService implements OnModuleInit, OnModuleDestroy {
  private memoryStore = new Map<string, Map<string, ServiceInstance>>();
  private roundRobinIndex = new Map<string, number>();
  private connectionCount = new Map<string, Map<string, number>>();
  private cleanupInterval?: NodeJS.Timeout;
  private redisClient?: RedisClientType;
  private useRedis = false;

  constructor(private readonly options: RegistryServiceOptions) {}

  async onModuleInit() {
    const redisUrl = process.env.NESTRO_REDIS_URL;
    if (redisUrl) {
      this.useRedis = true;
      this.redisClient = createClient({ url: redisUrl });
      await this.redisClient.connect();
      debugLog("RegistryService", "Connected to Redis", { redisUrl });
    } else {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5000);
      debugLog("RegistryService", "Using in-memory store");
    }
  }

  async onModuleDestroy() {
    if (this.useRedis && this.redisClient) {
      await this.redisClient.disconnect();
      debugLog("RegistryService", "Disconnected from Redis");
    } else if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      debugLog("RegistryService", "Stopped cleanup interval");
    }
  }

  async register(service: ServiceDto): Promise<void> {
    const key = service.name;
    const instance = this.createServiceInstance(service);
    const instanceId = this.getInstanceId(instance);

    if (this.useRedis && this.redisClient) {
      await this.redisClient.hSet(key, instanceId, JSON.stringify(instance));
      await this.redisClient.expire(key, this.options.cleanupTTL);
      debugLog("RegistryService", "Registered service in Redis", { key, instance });
    } else {
      if (!this.memoryStore.has(key)) {
        this.memoryStore.set(key, new Map());
      }
      this.memoryStore.get(key)!.set(instanceId, instance);
      debugLog("RegistryService", "Registered service in memory", { key, instance });
    }
  }

  async deregister(service: ServiceDto): Promise<void> {
    const key = service.name;
    const instanceId = this.getInstanceId(service);

    if (this.useRedis && this.redisClient) {
      await this.redisClient.hDel(key, instanceId);
      debugLog("RegistryService", "Deregistered service from Redis", { key, instanceId });
    } else {
      this.memoryStore.get(key)?.delete(instanceId);
      if (this.memoryStore.get(key)?.size === 0) {
        this.memoryStore.delete(key);
      }
      debugLog("RegistryService", "Deregistered service from memory", { key, instanceId });
    }
  }

  async heartbeat(service: ServiceDto): Promise<void> {
    const key = service.name;
    const instanceId = this.getInstanceId(service);

    if (this.useRedis && this.redisClient) {
      await this.redisClient.expire(key, this.options.cleanupTTL);
      debugLog("RegistryService", "Heartbeat received in Redis", { key });
    } else {
      const instance = this.memoryStore.get(key)?.get(instanceId);
      if (instance) {
        instance.expireAt = Date.now() + this.options.cleanupTTL * 1000;
        debugLog("RegistryService", "Heartbeat updated in memory", { key, instance });
      }
    }
  }

  async getService(serviceName: string, clientIp?: string): Promise<ServiceInstance | null> {
    const services = await this.getServices(serviceName);
    if (services.length === 0) {
      debugLog("RegistryService", "No services found", { serviceName });
      return null;
    }
    const selected = this.selectService(serviceName, services, clientIp);
    debugLog("RegistryService", "Selected service", { serviceName, selected });
    return selected;
  }

  async getServices(serviceName?: string): Promise<ServiceInstance[]> {
    if (this.useRedis && this.redisClient) {
      if (serviceName) {
        const instances = await this.redisClient.hGetAll(serviceName);
        const parsedInstances = Object.values(instances).map((instance) => JSON.parse(instance));
        debugLog("RegistryService", "Fetched services from Redis", { serviceName, count: parsedInstances.length });
        return parsedInstances;
      } else {
        const keys = await this.redisClient.keys("*");
        const services = await Promise.all(
          keys.map(async (key) => {
            const instances = await this.redisClient.hGetAll(key);
            return Object.values(instances).map((instance) => JSON.parse(instance));
          })
        );
        const flatServices = services.flat();
        debugLog("RegistryService", "Fetched all services from Redis", { count: flatServices.length });
        return flatServices;
      }
    } else {
      console.log(this.memoryStore);

      const flatServices = serviceName
        ? Array.from(this.memoryStore.get(serviceName)?.values() || [])
        : Array.from(this.memoryStore.values()).flatMap((map) => Array.from(map.values()));
      debugLog("RegistryService", "Fetched services from memory", { serviceName, count: flatServices.length });
      return flatServices;
    }
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, instances] of this.memoryStore.entries()) {
      for (const [id, instance] of instances.entries()) {
        if (instance.expireAt < now) {
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

  private selectService(serviceName: string, services: ServiceInstance[], clientIp?: string): ServiceInstance {
    switch (this.options.loadBalancingStrategy) {
      case "random":
        return services[Math.floor(Math.random() * services.length)];
      case "round-robin":
        if (services.length === 1) return services[0];
        return this.roundRobinSelection(serviceName, services);
      case "ip-hash":
        return clientIp ? this.ipHashSelection(clientIp, services) : services[0];
      case "least-connections":
        return this.leastConnectionsSelection(serviceName, services);
      default:
        return services[0];
    }
  }

  private roundRobinSelection(serviceName: string, services: ServiceInstance[]): ServiceInstance {
    const index = this.roundRobinIndex.get(serviceName) || 0;
    this.roundRobinIndex.set(serviceName, (index + 1) % services.length);
    return services[index % services.length];
  }

  private ipHashSelection(clientIp: string, services: ServiceInstance[]): ServiceInstance {
    const hash = this.hashString(clientIp);
    return services[hash % services.length];
  }

  private leastConnectionsSelection(serviceName: string, services: ServiceInstance[]): ServiceInstance {
    if (!this.connectionCount.has(serviceName)) {
      this.connectionCount.set(serviceName, new Map());
    }
    const serviceConnections = this.connectionCount.get(serviceName)!;
    return services.reduce((least, service) => {
      const id = this.getInstanceId(service);
      const connections = serviceConnections.get(id) || 0;
      return connections < (serviceConnections.get(this.getInstanceId(least)) || 0) ? service : least;
    }, services[0]);
  }

  private hashString(str: string): number {
    return Math.abs(str.split("").reduce((hash, char) => (hash << 5) - hash + char.charCodeAt(0), 0));
  }

  private createServiceInstance(service: ServiceDto): ServiceInstance {
    return { ...service, expireAt: Date.now() + this.options.cleanupTTL * 1000, timestamp: Date.now() };
  }

  private getInstanceId(instance: ServiceDto): string {
    return `${instance.host}:${instance.port}`;
  }
}
