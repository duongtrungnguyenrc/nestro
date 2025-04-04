import { ILoadBalancer } from "../interfaces";
import { ServiceInstance } from "../../common";

/**
 * Least-connections load balancing strategy
 * Routes to the instance with the fewest active connections
 */
export class LeastConnectionsStrategy implements ILoadBalancer {
  private connectionCounters: Map<string, number> = new Map();

  selectInstance(instances: ServiceInstance[]): ServiceInstance | null {
    if (!instances || instances.length === 0) {
      return null;
    }

    if (instances.length === 1) {
      return instances[0];
    }

    let minConnections = Number.MAX_SAFE_INTEGER;
    let selectedInstance = instances[0];
    let candidatesWithSameConnections: ServiceInstance[] = [];

    // Find instance with minimum connections
    for (const instance of instances) {
      const instanceId = this.getInstanceId(instance);
      const connections = this.connectionCounters.get(instanceId) || 0;

      if (connections < minConnections) {
        minConnections = connections;
        selectedInstance = instance;
        candidatesWithSameConnections = [instance];
      } else if (connections === minConnections) {
        // If multiple instances have the same connection count, add to candidates
        candidatesWithSameConnections.push(instance);
      }
    }

    // If multiple instances have the same (minimum) connection count, select one randomly
    if (candidatesWithSameConnections.length > 1) {
      const randomIndex = Math.floor(Math.random() * candidatesWithSameConnections.length);
      selectedInstance = candidatesWithSameConnections[randomIndex];
    }

    return selectedInstance;
  }

  trackConnectionStart(instanceId: string): void {
    const currentCount = this.connectionCounters.get(instanceId) || 0;
    this.connectionCounters.set(instanceId, currentCount + 1);
  }

  trackConnectionEnd(instanceId: string): void {
    const currentCount = this.connectionCounters.get(instanceId) || 0;
    if (currentCount > 0) {
      this.connectionCounters.set(instanceId, currentCount - 1);
    }
  }

  reset(): void {
    this.connectionCounters.clear();
  }

  private getInstanceId(instance: ServiceInstance): string {
    return `${instance.name}:${instance.host}:${instance.port}`;
  }
}
