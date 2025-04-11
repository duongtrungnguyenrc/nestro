import { Inject, Injectable } from "@nestjs/common";

import { IRegistryStorage, STORAGE, STORAGE_OPTIONS, StorageOptions } from "../../storage";
import type { RegisterResponse } from "../types";
import type { Service } from "../../common";

@Injectable()
export class RegistryService {
  constructor(
    @Inject(STORAGE_OPTIONS) private readonly storageOptions: StorageOptions,
    @Inject(STORAGE) private readonly storage: IRegistryStorage
  ) {}

  async register(service: Service): Promise<RegisterResponse> {
    const key = service.name;
    await this.storage.register(key, service);

    return { heartbeatInterval: this.storageOptions.heartbeatInterval };
  }

  async deregister(service: Service) {
    await this.storage.deregister(service.name, service);
    return { message: "Deregistered" };
  }

  async heartbeat(service: Service) {
    await this.storage.heartbeat(service.name, service);
    return { message: "Heartbeat received" };
  }

  async getServices(serviceName?: string) {
    return await this.storage.getServices(serviceName);
  }
}
