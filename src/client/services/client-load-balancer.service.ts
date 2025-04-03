import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from "@nestjs/common";

import type { ClientLoadBalancingOptions, FailedInstanceInfo, LoadBalancingRetryOptions, ServerInfo } from "../types";
import { CLIENT_LOADBALANCING_OPTION, INSTANCES, RETRY_OPTIONS, SERVER_INFO } from "../constants";
import { LoadBalancer, LoadBalancerFactory } from "src/loadbalancer";
import { debugLog, ServiceInstance } from "src/common";

@Injectable()
export class ClientLoadBalancerService implements OnModuleInit, OnModuleDestroy {
  private readonly failedInstances: Map<string, Map<string, FailedInstanceInfo>> = new Map();
  private refreshIntervalId: NodeJS.Timeout;
  private cleanupIntervalId: NodeJS.Timeout;
  private loadBalancer: LoadBalancer;

  constructor(
    @Inject(SERVER_INFO) private readonly serverInfo: ServerInfo,
    @Inject(CLIENT_LOADBALANCING_OPTION) private readonly loadBalancingOptions: ClientLoadBalancingOptions,
    @Inject(RETRY_OPTIONS) private readonly retryOptions: LoadBalancingRetryOptions,
    @Inject(INSTANCES) private readonly serviceInstances: Record<string, ServiceInstance[]>
  ) {
    this.loadBalancer = LoadBalancerFactory.create(loadBalancingOptions.strategy);
  }

  async onModuleInit() {
    await this.loadRegisteredInstances();
    this.refreshIntervalId = setInterval(
      () => this.loadRegisteredInstances(),
      this.loadBalancingOptions.refreshInterval
    );
    this.cleanupIntervalId = setInterval(() => this.cleanupFailedInstances(), 30000);
  }

  async onModuleDestroy() {
    clearInterval(this.refreshIntervalId);
    clearInterval(this.cleanupIntervalId);
  }

  async loadRegisteredInstances(): Promise<void> {
    try {
      const response = await fetch(
        `${this.serverInfo.protocol}://${this.serverInfo.host}:${this.serverInfo.port}/nestro/services`
      );

      if (!response.ok) throw new Error(`Failed to fetch services: ${response.statusText}`);

      const services: Record<string, ServiceInstance[]> = await response.json();

      for (const serviceName in services) {
        this.serviceInstances[serviceName] = services[serviceName].filter((instance) => instance.status === "ON");
        this.checkForRecoveredInstances(serviceName, this.serviceInstances[serviceName]);

        debugLog(
          ClientLoadBalancerService.name,
          `Loaded ${this.serviceInstances[serviceName].length} instances for service ${serviceName}`
        );
      }
    } catch (error) {
      console.error("Error refreshing instances", error.message);
    }
  }

  getNextInstance(serviceName: string): ServiceInstance | null {
    const allInstances = this.serviceInstances[serviceName] || [];
    if (allInstances.length === 0) return null;

    const availableInstances = allInstances.filter((instance) => !this.isInstanceFailed(serviceName, instance));
    if (availableInstances.length > 0) return this.loadBalancer.select(serviceName, availableInstances);

    const retryableInstances = this.getRetryableInstances(serviceName, allInstances);
    if (retryableInstances.length > 0) {
      const selected = this.loadBalancer.select(serviceName, retryableInstances);
      this.updateRetryAttempt(serviceName, selected);
      return selected;
    }

    return this.loadBalancer.select(serviceName, allInstances);
  }

  markInstanceFailed(serviceName: string, instance: ServiceInstance): void {
    const instanceKey = this.getInstanceKey(instance);
    if (!this.failedInstances.has(serviceName)) {
      this.failedInstances.set(serviceName, new Map());
    }
    const serviceMap = this.failedInstances.get(serviceName)!;
    const existingInfo = serviceMap.get(instanceKey);
    const retryCount = existingInfo ? existingInfo.retryCount + 1 : 1;
    const backoffMs = Math.min(
      this.retryOptions.initialBackoffMs * Math.pow(this.retryOptions.backoffMultiplier, retryCount - 1),
      this.retryOptions.maxBackoffMs
    );
    const nextRetryAt = Date.now() + backoffMs;
    serviceMap.set(instanceKey, { instance, failedAt: Date.now(), retryCount, nextRetryAt });
    console.warn(
      `Instance ${instanceKey} for service ${serviceName} marked as failed. Retry #${retryCount}, next retry in ${backoffMs}ms`
    );
  }

  private isInstanceFailed(serviceName: string, instance: ServiceInstance): boolean {
    const instanceKey = this.getInstanceKey(instance);
    if (!this.failedInstances.has(serviceName)) return false;
    const serviceMap = this.failedInstances.get(serviceName)!;
    if (!serviceMap.has(instanceKey)) return false;
    return Date.now() < serviceMap.get(instanceKey)!.nextRetryAt;
  }

  private getRetryableInstances(serviceName: string, instances: ServiceInstance[]): ServiceInstance[] {
    if (!this.failedInstances.has(serviceName)) return [];
    const serviceMap = this.failedInstances.get(serviceName)!;
    const now = Date.now();
    return instances.filter((instance) => {
      const key = this.getInstanceKey(instance);
      if (!serviceMap.has(key)) return false;
      return now >= serviceMap.get(key)!.nextRetryAt;
    });
  }

  private updateRetryAttempt(serviceName: string, instance: ServiceInstance): void {
    const instanceKey = this.getInstanceKey(instance);
    if (this.failedInstances.has(serviceName)) {
      const serviceMap = this.failedInstances.get(serviceName)!;
      if (serviceMap.has(instanceKey)) {
        const info = serviceMap.get(instanceKey)!;
        console.log(`Retry attempt ${info.retryCount} for instance ${instanceKey} of service ${serviceName}`);
      }
    }
  }

  private checkForRecoveredInstances(serviceName: string, instances: ServiceInstance[]): void {
    if (!this.failedInstances.has(serviceName)) return;

    const serviceMap = this.failedInstances.get(serviceName)!;
    const instanceKeys = new Set(instances.map((instance) => this.getInstanceKey(instance)));

    for (const [key, info] of serviceMap.entries()) {
      if (instanceKeys.has(key) && Date.now() - info.failedAt >= this.retryOptions.resetTimeoutMs) {
        serviceMap.delete(key);
      }
    }
  }

  private cleanupFailedInstances(): void {
    for (const [serviceName, serviceMap] of this.failedInstances.entries()) {
      const instances = this.serviceInstances[serviceName] || [];
      const instanceKeys = new Set(instances.map((instance) => this.getInstanceKey(instance)));

      for (const key of serviceMap.keys()) {
        if (!instanceKeys.has(key)) serviceMap.delete(key);
      }

      if (serviceMap.size === 0) this.failedInstances.delete(serviceName);
    }
  }

  private getInstanceKey(instance: ServiceInstance): string {
    return `${instance.protocol}://${instance.host}:${instance.port}`;
  }
}
