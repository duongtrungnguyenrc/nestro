import type { ServiceInstance } from "../../common";

import { LoadBalancer } from "./base-load-balancer.service";

export class RandomLoadBalancer extends LoadBalancer {
  select(_: string, services: ServiceInstance[]): ServiceInstance {
    return services[Math.floor(Math.random() * services.length)];
  }
}
