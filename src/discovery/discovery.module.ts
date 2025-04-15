import { DynamicModule, FactoryProvider, Module, ValueProvider } from "@nestjs/common";

import { DEFAULT_LOAD_BALANCING_REFRESH_INTERVAL, DEFAULT_LOAD_BALANCING_STRATEGY, LOAD_BALANCER, LOAD_BALANCING_CONFIGS } from "./constants";
import { DiscoveryService, FailureTrackerService } from "./services";
import { LoadBalancingFactory } from "./loadbalancing";
import { LoadBalancingConfigs } from "./types";
import { ILoadBalancer } from "./interfaces";

@Module({})
export class DiscoveryModule {
  static register(config: LoadBalancingConfigs): DynamicModule {
    const loadBalancingConfigProvider: ValueProvider<LoadBalancingConfigs> = {
      provide: LOAD_BALANCING_CONFIGS,
      useValue: {
        ...config,
        strategy: config.strategy || DEFAULT_LOAD_BALANCING_STRATEGY,
        refreshInterval: config.refreshInterval || DEFAULT_LOAD_BALANCING_REFRESH_INTERVAL,
      },
    };

    const loadBalancerProvider: FactoryProvider<ILoadBalancer> = {
      provide: LOAD_BALANCER,
      useFactory: (options: LoadBalancingConfigs) => {
        return LoadBalancingFactory.getStrategy(options.strategy);
      },
      inject: [LOAD_BALANCING_CONFIGS],
    };

    return {
      module: DiscoveryModule,
      providers: [loadBalancingConfigProvider, loadBalancerProvider, FailureTrackerService, DiscoveryService],
      exports: [DiscoveryService],
    };
  }
}
