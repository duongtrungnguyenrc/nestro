import { ILoadBalancer } from "../interfaces";
import { Service } from "../../common";
/**
 * Weighted Round-Robin load balancing strategy
 * Distributes requests based on instance weights
 */
export class WeightedRoundRobinStrategy implements ILoadBalancer {
  private counters: Map<string, number> = new Map();
  private readonly defaultWeight = 1;

  selectInstance(instances: Service[]): Service | null {
    if (!instances || instances.length === 0) {
      return null;
    }

    if (instances.length === 1) {
      return instances[0];
    }

    // Get service name from the first instance
    const serviceName = instances[0].name;

    // Calculate total weight
    let totalWeight = 0;
    const weights: number[] = instances.map((instance) => {
      const weight = instance.metadata?.weight || this.defaultWeight;
      totalWeight += weight;
      return weight;
    });

    // Get or initialize counter for this service
    let counter = this.counters.get(serviceName) || 0;
    counter = (counter + 1) % totalWeight;
    this.counters.set(serviceName, counter);

    // Select instance based on weight
    let weightSum = 0;
    for (let i = 0; i < instances.length; i++) {
      weightSum += weights[i];
      if (counter < weightSum) {
        return instances[i];
      }
    }

    // Fallback to first instance (should not happen)
    return instances[0];
  }

  reset(): void {
    this.counters.clear();
  }
}
