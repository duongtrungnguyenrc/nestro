import { Injectable, type OnModuleInit, type OnModuleDestroy, Inject } from "@nestjs/common";

import { debugError, debugLog, getServerURL, Service } from "../../common";
import { LOAD_BALANCER, LOAD_BALANCING_CONFIGS } from "../constants";
import { DiscoveryError, DiscoveryErrorCode } from "../errors";
import { ResponseTimeStrategy } from "../loadbalancing";
import { SERVER_INFO, ServerInfo } from "../../client";
import type { LoadBalancingConfig } from "../types";
import { ILoadBalancer } from "../interfaces";

@Injectable()
export class DiscoveryService implements OnModuleInit, OnModuleDestroy {
  private services: Map<string, Service[]> = new Map();
  private refreshIntervalId: NodeJS.Timeout;
  private serverBaseUrl: string;

  constructor(
    @Inject(LOAD_BALANCING_CONFIGS) private readonly loadBalancingConfigs: LoadBalancingConfig,
    @Inject(LOAD_BALANCER) private readonly loadBalancer: ILoadBalancer,
    @Inject(SERVER_INFO) serverInfo: ServerInfo
  ) {
    this.serverBaseUrl = getServerURL(serverInfo);
  }

  async onModuleInit() {
    debugLog(DiscoveryService.name, "Initializing DiscoveryService...");
    await this.loadInstances();
    this.refreshIntervalId = setInterval(() => this.loadInstances(), this.loadBalancingConfigs.refreshInterval);
  }

  onModuleDestroy() {
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
    }
    debugLog(DiscoveryService.name, "DiscoveryService stopped");
  }

  /**
   * Refreshes the service registry by fetching the latest instances from the server
   */
  async loadInstances(): Promise<void> {
    debugLog(DiscoveryService.name, "Refreshing service registry");

    try {
      const response = await fetch(`${this.serverBaseUrl}/nestro/services`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch services: ${response.statusText}`);
      }

      const services = (await response.json()) as Record<string, Service[]>;

      // Update the service registry
      this.services.clear();
      Object.entries(services).forEach(([serviceName, instances]) => {
        // Filter out instances with status OFF
        const activeInstances = instances.filter((instance) => instance.status === "ON");
        if (activeInstances.length > 0) {
          this.services.set(serviceName, activeInstances);
        }
      });

      debugLog(DiscoveryService.name, `Registry refreshed with ${this.services.size} services`);
    } catch (error) {
      debugError(DiscoveryService.name, `Failed to refresh registry: ${error.message}`);
    }
  }

  getServices() {
    return this.services;
  }

  /**
   * Gets all instances for a specific service
   */
  getInstances(serviceName: string): Service[] {
    return this.services.get(serviceName) || [];
  }

  async discover<T>(serviceName: string, callback: (instance: Service, tryAnotherInstance: VoidFunction) => Promise<T> | T): Promise<T> {
    const instances = this.getInstances(serviceName);

    if (!instances || instances.length === 0) {
      throw new DiscoveryError(`Service ${serviceName} not found in registry`, DiscoveryErrorCode.SERVICE_NOT_FOUND);
    }

    // Try each instance until success or we run out of instances
    let lastError: DiscoveryError | null = null;
    const attemptedInstances = new Set<string>();
    const maxRetries = instances.length;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Select an instance that hasn't been tried yet in this request
      const remainingInstances = instances.filter((instance) => !attemptedInstances.has(this.getInstanceId(instance)));

      if (remainingInstances.length === 0) {
        break; // No more instances to try
      }

      const selectedInstance: Service = this.loadBalancer.selectInstance(remainingInstances);

      if (!selectedInstance) {
        break; // No instance selected
      }

      const instanceId: string = this.getInstanceId(selectedInstance);
      attemptedInstances.add(instanceId);

      // Track connection if strategy supports it
      if (this.loadBalancer.trackConnectionStart) {
        this.loadBalancer.trackConnectionStart(instanceId);
      }

      const startTime = Date.now();
      let shouldRetry = false;

      const tryAnotherInstance = async () => {
        // Mark this instance as temporarily failed
        attemptedInstances.add(this.getInstanceId(selectedInstance));

        // Track connection end if strategy supports it
        if (this.loadBalancer.trackConnectionEnd) {
          this.loadBalancer.trackConnectionEnd(instanceId);
        }

        shouldRetry = true;
      };

      try {
        const result = await callback(selectedInstance, tryAnotherInstance);

        // Record response time for response-time strategy
        if (this.loadBalancer instanceof ResponseTimeStrategy) {
          const responseTime = Date.now() - startTime;
          this.loadBalancer.recordResponseTime(instanceId, responseTime);
        }

        if (!shouldRetry) {
          return result;
        }
      } catch (error) {
        if (!shouldRetry) {
          throw error;
        }
      }
    }

    if (lastError) throw lastError;

    throw new DiscoveryError(`All instances for ${serviceName} service failed`, DiscoveryErrorCode.ALL_INSTANCES_FAILED);
  }

  private getInstanceId(instance: Service): string {
    return `${instance.name}:${instance.host}:${instance.port}`;
  }
}
