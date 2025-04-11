import { DynamicModule, FactoryProvider, Module, ValueProvider } from "@nestjs/common";

import { DEFAULT_CLEANUP_TTL, DEFAULT_EVICTATION_THRESHOLD, DEFAULT_HEARBEAT_INTERVAL } from "../common";
import type { StorageConfigs, StorageOptions } from "./types";
import { STORAGE, STORAGE_OPTIONS } from "./constants";
import { IRegistryStorage } from "./interfaces";
import { MemoryStorage } from "./services";

@Module({})
export class StorageModule {
  static register(config: StorageConfigs): DynamicModule {
    const storageOptionsProvider: ValueProvider<StorageOptions> = {
      provide: STORAGE_OPTIONS,
      useValue: {
        cleanupTTL: config.cleanupTTL ?? DEFAULT_CLEANUP_TTL,
        heartbeatInterval: config.heartbeatInterval ?? DEFAULT_HEARBEAT_INTERVAL,
        evictionThreshold: config.evictionThreshold ?? DEFAULT_EVICTATION_THRESHOLD,
      },
    };

    const storageProvider: FactoryProvider<IRegistryStorage> = {
      provide: STORAGE,
      useFactory: (options: StorageOptions) => new MemoryStorage(options),
      inject: [STORAGE_OPTIONS],
    };

    return {
      module: StorageModule,
      providers: [storageOptionsProvider, storageProvider],
      exports: [storageOptionsProvider, storageProvider],
    };
  }
}
