import type { ServiceInstance } from "src/common";

import { LoadBalancer } from "./base-load-balancer.service";

export class LeastConnectionsLoadBalancer extends LoadBalancer {
  private connectionCount = new Map<string, Map<string, number>>();

  select(serviceName: string, services: ServiceInstance[]): ServiceInstance {
    if (!this.connectionCount.has(serviceName)) {
      this.connectionCount.set(serviceName, new Map());
    }

    const serviceConnections = this.connectionCount.get(serviceName)!;

    return services.reduce((least, service) => {
      if (service.status === "OFF") return least;

      const id = this.getInstanceId(service);
      const connections = serviceConnections.get(id) || 0;
      return connections < (serviceConnections.get(this.getInstanceId(least)) || 0) ? service : least;
    }, services[0]);
  }

  private getInstanceId(instance: ServiceInstance): string {
    return `${instance.host}:${instance.port}`;
  }
}
