import { LoadBalancingStrategy, ServiceDto } from "../global-types";

export type ServiceInstance = ServiceDto & {
  timestamp: number;
  expireAt?: number;
};

export type RegistryServiceOptions = {
  loadBalancingStrategy?: LoadBalancingStrategy;
  cleanupTTL: number;
};
