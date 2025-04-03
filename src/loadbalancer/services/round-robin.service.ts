import type { ServiceInstance } from "../../common";

import { LoadBalancer } from "./base-load-balancer.service";

export class RoundRobinLoadBalancer extends LoadBalancer {
  private roundRobinIndex = new Map<string, number>();

  select(serviceName: string, services: ServiceInstance[]): ServiceInstance {
    const availableServices = this.getAvailableInstances(serviceName, services);
    if (availableServices.length === 0) throw new Error("No available instances");

    const index = this.roundRobinIndex.get(serviceName) ?? 0;
    this.roundRobinIndex.set(serviceName, (index + 1) % availableServices.length);

    return availableServices[index % availableServices.length];
  }
}
