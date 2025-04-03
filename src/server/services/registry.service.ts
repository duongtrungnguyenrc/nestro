import { Injectable, type OnModuleInit, type OnModuleDestroy } from "@nestjs/common";

import { IRegistryStorage, MemoryStorage } from "../storage";
import type { Service, ServiceInstance } from "../../common";
import { type RegistryServiceOptions } from "../types";

@Injectable()
export class RegistryService implements OnModuleInit, OnModuleDestroy {
  private storage: IRegistryStorage;

  constructor(private readonly options: RegistryServiceOptions) {
    this.storage = new MemoryStorage(options);
  }

  async onModuleInit() {}

  async onModuleDestroy() {
    await this.storage.disconnect?.();
  }

  async register(service: Service): Promise<void> {
    const key = service.name;
    const instance = this.createServiceInstance(service);
    const instanceId = this.getInstanceId(instance);
    await this.storage.register(key, instanceId, instance);
  }

  async deregister(service: Service): Promise<void> {
    const key = service.name;
    const instanceId = this.getInstanceId(service);
    await this.storage.deregister(key, instanceId);
  }

  async heartbeat(service: Service): Promise<void> {
    const key = service.name;
    const instanceId = this.getInstanceId(service);
    await this.storage.heartbeat(key, instanceId, this.options.cleanupTTL);
  }

  async getServices(serviceName?: string): Promise<Record<string, ServiceInstance[]>> {
    return await this.storage.getServices(serviceName);
  }

  private createServiceInstance(service: Service): ServiceInstance {
    return { ...service, expireAt: Date.now() + this.options.cleanupTTL * 1000, timestamp: Date.now(), status: "ON" };
  }

  private getInstanceId(instance: Service): string {
    return `${instance.host}:${instance.port}`;
  }
}
