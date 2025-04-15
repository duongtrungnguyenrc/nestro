import { BeforeApplicationShutdown, Inject, Injectable } from "@nestjs/common";

import { IRegistryStorage, STORAGE, STORAGE_OPTIONS, StorageOptions } from "../../storage";
import { debugLog, type Service } from "../../common";
import type { RegisterResponse } from "../types";

@Injectable()
export class RegistryService implements BeforeApplicationShutdown {
  constructor(
    @Inject(STORAGE_OPTIONS) private readonly storageOptions: StorageOptions,
    @Inject(STORAGE) private readonly storage: IRegistryStorage
  ) {}

  beforeApplicationShutdown() {
    debugLog("Nestro server", "Nestro server stopping");
  }

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
