import type { ServiceInstance } from "../../common";

export abstract class LoadBalancer {
  private failedInstances = new Map<string, number>();

  abstract select(serviceName: string, services: ServiceInstance[]): ServiceInstance;

  protected getAvailableInstances(serviceName: string, services: ServiceInstance[]): ServiceInstance[] {
    return services.filter((s) => s.status === "ON" && !this.isInstanceFailed(serviceName, s));
  }

  private isInstanceFailed(serviceName: string, instance: ServiceInstance): boolean {
    const key = `${serviceName}-${instance.host}:${instance.port}`;
    return (this.failedInstances.get(key) ?? 0) > Date.now();
  }

  protected markInstanceFailed(serviceName: string, instance: ServiceInstance, retryAfterMs = 30000) {
    const key = `${serviceName}-${instance.host}:${instance.port}`;
    this.failedInstances.set(key, Date.now() + retryAfterMs);
  }
}
