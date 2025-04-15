import { ServiceInstance } from "../../common";
import { ILoadBalancer } from "../interfaces";

/**
 * Response Time load balancing strategy
 * Routes to the instance with the fastest average response time
 */
export class ResponseTimeStrategy implements ILoadBalancer {
  private responseTimes: Map<string, number[]> = new Map();
  private readonly maxSamples = 10; // Number of samples to keep for average calculation

  selectInstance(instances: ServiceInstance[]): ServiceInstance | null {
    if (!instances || instances.length === 0) {
      return null;
    }

    if (instances.length === 1) {
      return instances[0];
    }

    let fastestInstance = instances[0];
    let fastestTime = this.getAverageResponseTime(this.getInstanceId(fastestInstance));

    // If we don't have response time data for any instance yet, use random selection
    const hasData = fastestTime !== null;

    if (!hasData) {
      const randomIndex = Math.floor(Math.random() * instances.length);
      return instances[randomIndex];
    }

    // Find instance with fastest response time
    for (let i = 1; i < instances.length; i++) {
      const instanceId = this.getInstanceId(instances[i]);
      const avgTime = this.getAverageResponseTime(instanceId);

      if (avgTime !== null && (fastestTime === null || avgTime < fastestTime)) {
        fastestTime = avgTime;
        fastestInstance = instances[i];
      }
    }

    return fastestInstance;
  }

  /**
   * Record response time for an instance
   */
  recordResponseTime(instanceId: string, responseTimeMs: number): void {
    let times = this.responseTimes.get(instanceId) || [];

    // Add new sample
    times.push(responseTimeMs);

    // Keep only the most recent samples
    if (times.length > this.maxSamples) {
      times = times.slice(-this.maxSamples);
    }

    this.responseTimes.set(instanceId, times);
  }

  /**
   * Get average response time for an instance
   */
  private getAverageResponseTime(instanceId: string): number | null {
    const times = this.responseTimes.get(instanceId);

    if (!times || times.length === 0) {
      return null;
    }

    const sum = times.reduce((acc, time) => acc + time, 0);
    return sum / times.length;
  }

  private getInstanceId(instance: ServiceInstance): string {
    return `${instance.name}:${instance.host}:${instance.port}`;
  }

  reset(): void {
    this.responseTimes.clear();
  }
}
