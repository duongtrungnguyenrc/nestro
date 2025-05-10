import { Injectable } from "@nestjs/common";

import { debugWarn, ServiceInfo } from "../../common";

@Injectable()
export class FailureTrackerService {
  private failedInstances: Map<string, number> = new Map(); // instanceId -> timestamp when it failed
  private readonly failureDuration: number = 30000; // How long to consider an instance as failed (30 seconds)

  /**
   * Mark an instance as temporarily failed
   */
  markAsFailed(instance: ServiceInfo): void {
    const instanceId = this.getInstanceId(instance);
    this.failedInstances.set(instanceId, Date.now() + 30000);
    debugWarn(FailureTrackerService.name, `Instance ${instanceId} marked as temporarily failed`);
  }

  /**
   * Check if an instance is currently marked as failed
   */
  isMarkedAsFailed(instance: ServiceInfo): boolean {
    const instanceId = this.getInstanceId(instance);
    const failureTime = this.failedInstances.get(instanceId);

    if (!failureTime) {
      return false;
    }

    // Check if the failure duration has passed
    const now = Date.now();

    if (now >= this.failureDuration) {
      // Failure duration has passed, remove from failed instances
      this.failedInstances.delete(instanceId);
      return false;
    }

    return true;
  }

  /**
   * Get all available (non-failed) instances
   */
  getAvailableInstances(instances: ServiceInfo[]): ServiceInfo[] {
    return instances.filter((instance) => !this.isMarkedAsFailed(instance));
  }

  /**
   * Reset all failed instances (e.g., after registry refresh)
   */
  resetAll(): void {
    this.failedInstances.clear();
  }

  /**
   * Get instance ID from ServiceInfo
   */
  private getInstanceId(instance: ServiceInfo): string {
    return `${instance.name}:${instance.host}:${instance.port}`;
  }
}
