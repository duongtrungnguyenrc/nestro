import { ServiceInstance } from "../../common";

/**
 * Interface for load balancing strategies
 */
export interface ILoadBalancer {
  /**
   * Select an instance from the available instances
   */
  selectInstance(instances: ServiceInstance[]): ServiceInstance | null;

  /**
   * Optional method to track when a connection starts
   */
  trackConnectionStart?(instanceId: string): void;

  /**
   * Optional method to track when a connection ends
   */
  trackConnectionEnd?(instanceId: string): void;

  /**
   * Optional method to reset the strategy state
   */
  reset?(): void;
}
