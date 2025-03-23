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
  private requestCounts = new Map<string, Map<string, number>>();
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

  async incrementRequestCount(serviceName: string, instanceId: string): Promise<void> {
    if (this.useRedis && this.redisClient) {
      const countKey = `${serviceName}:requests`;
      await this.redisClient.hIncrBy(countKey, instanceId, 1);
      debugLog("RegistryService", "Incremented request count in Redis", { serviceName, instanceId });
    } else {
      if (!this.requestCounts.has(serviceName)) {
        this.requestCounts.set(serviceName, new Map());
      }
      const serviceRequests = this.requestCounts.get(serviceName)!;
      const currentCount = serviceRequests.get(instanceId) || 0;
      serviceRequests.set(instanceId, currentCount + 1);
      debugLog("RegistryService", "Incremented request count in memory", { serviceName, instanceId, count: currentCount + 1 });
    }
  }

  async getService(serviceName: string, clientIp?: string): Promise<ServiceInstance | null> {
    const services = await this.getServices(serviceName);
    if (services.length === 0) {
      debugLog("RegistryService", "No services found", { serviceName });
      return null;
    }
    const selected = this.selectService(serviceName, services, clientIp);
    
    const instanceId = this.getInstanceId(selected);
    await this.incrementRequestCount(serviceName, instanceId);
    
    debugLog("RegistryService", "Selected service", { serviceName, selected });
    return selected;
  }

  async getServices(serviceName?: string): Promise<ServiceInstance[]> {
    let services: ServiceInstance[];
    
    if (this.useRedis && this.redisClient) {
      if (serviceName) {
        const instances = await this.redisClient.hGetAll(serviceName);
        services = Object.values(instances).map((instance) => JSON.parse(instance));
        
        const countKey = `${serviceName}:requests`;
        const requestCounts = await this.redisClient.hGetAll(countKey);
        
        services = services.map(service => {
          const instanceId = this.getInstanceId(service);
          return {
            ...service,
            requestCount: parseInt(requestCounts[instanceId] || '0', 10)
          };
        });
        
        debugLog("RegistryService", "Fetched services from Redis", { serviceName, count: services.length });
      } else {
        const keys = await this.redisClient.keys("*");
        const serviceKeys = keys.filter(key => !key.includes(':requests'));
        
        const servicesPromises = serviceKeys.map(async (key) => {
          const instances = await this.redisClient.hGetAll(key);
          const countKey = `${key}:requests`;
          const requestCounts = await this.redisClient.hGetAll(countKey);
          
          return Object.entries(instances).map(([instanceId, instanceStr]) => {
            const instance = JSON.parse(instanceStr);
            return {
              ...instance,
              requestCount: parseInt(requestCounts[instanceId] || '0', 10)
            };
          });
        });
        
        services = (await Promise.all(servicesPromises)).flat();
        debugLog("RegistryService", "Fetched all services from Redis", { count: services.length });
      }
    } else {
      if (serviceName) {
        const instances = Array.from(this.memoryStore.get(serviceName)?.values() || []);
        const requestCountMap = this.requestCounts.get(serviceName) || new Map();
        
        services = instances.map(instance => {
          const instanceId = this.getInstanceId(instance);
          return {
            ...instance,
            requestCount: requestCountMap.get(instanceId) || 0
          };
        });
      } else {
        services = [];
        for (const [serviceName, instances] of this.memoryStore.entries()) {
          const requestCountMap = this.requestCounts.get(serviceName) || new Map();
          
          const serviceInstances = Array.from(instances.values()).map(instance => {
            const instanceId = this.getInstanceId(instance);
            return {
              ...instance,
              requestCount: requestCountMap.get(instanceId) || 0
            };
          });
          
          services.push(...serviceInstances);
        }
      }
      
      debugLog("RegistryService", "Fetched services from memory", { serviceName, count: services.length });
    }
    
    return services;
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
