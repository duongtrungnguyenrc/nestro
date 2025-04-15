import { ILoadBalancer } from "../interfaces";
import { ServiceInstance } from "../../common";

/**
 * Random load balancing strategy
 * Selects a random instance from the available instances
 */
export class RandomStrategy implements ILoadBalancer {
  selectInstance(instances: ServiceInstance[]): ServiceInstance | null {
    if (!instances || instances.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * instances.length);
    return instances[randomIndex];
  }
}
