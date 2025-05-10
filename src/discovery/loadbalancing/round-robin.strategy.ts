import { ILoadBalancer } from "../interfaces";
import { Service } from "../../common";

/**
 * Round-robin load balancing strategy
 * Distributes requests sequentially across instances
 */
export class RoundRobinStrategy implements ILoadBalancer {
  private counters: Map<string, number> = new Map();

  selectInstance(instances: Service[]): Service | null {
    if (!instances || instances.length === 0) {
      return null;
    }

    if (instances.length === 1) {
      return instances[0];
    }

    // Get service name from the first instance
    const serviceName = instances[0].name;

    // Get or initialize counter for this service
    let counter = this.counters.get(serviceName) || 0;

    // Select instance using round-robin
    const instance = instances[counter % instances.length];

    // Update counter for next selection
    counter = (counter + 1) % instances.length;
    this.counters.set(serviceName, counter);

    return instance;
  }

  reset(): void {
    this.counters.clear();
  }
}
