import { LeastConnectionsLoadBalancer } from "./least-connections.service";
import { RoundRobinLoadBalancer } from "./round-robin.service";
import { LoadBalancer } from "./base-load-balancer.service";
import { RandomLoadBalancer } from "./random.service";

export class LoadBalancerFactory {
  static create(strategy: string): LoadBalancer {
    switch (strategy) {
      case "random":
        return new RandomLoadBalancer();
      case "round-robin":
        return new RoundRobinLoadBalancer();
      case "least-connections":
        return new LeastConnectionsLoadBalancer();
      default:
        return new RandomLoadBalancer();
    }
  }
}
