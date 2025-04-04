import { Inject, Injectable } from "@nestjs/common";

import { IRegistryStorage, STORAGE, STORAGE_OPTIONS, StorageOptions } from "../../storage";
import type { Service, ServiceInstance } from "../../common";
import type { RegisterResponse } from "../types";

@Injectable()
export class RegistryService {
  constructor(
    @Inject(STORAGE_OPTIONS) private readonly storageOptions: StorageOptions,
    @Inject(STORAGE) private readonly storage: IRegistryStorage
  ) {}

  async register(service: Service): Promise<RegisterResponse> {
    const key = service.name;
    const instance = this.createServiceInstance(service);
    const instanceId = this.storage.getInstanceId(instance);
    await this.storage.register(key, instanceId, instance);

    return { heartbeatInterval: this.storageOptions.heartbeatInterval };
  }

  async deregister(service: Service) {
    const key = service.name;
    const instanceId = this.storage.getInstanceId(service);
    await this.storage.deregister(key, instanceId);

    return { message: "Deregistered" };
  }

  async heartbeat(service: Service) {
    const key = service.name;
    const instanceId = this.storage.getInstanceId(service);
    await this.storage.heartbeat(key, instanceId, this.storageOptions.cleanupTTL);

    return { message: "Heartbeat received" };
  }

  async getServices(serviceName?: string): Promise<Record<string, ServiceInstance[]>> {
    return await this.storage.getServices(serviceName);
  }

  private createServiceInstance(service: Service): ServiceInstance {
    return {
      ...service,
      expireAt: Date.now() + this.storageOptions.cleanupTTL * 1000,
      timestamp: Date.now(),
      status: "ON",
    };
  }
}
