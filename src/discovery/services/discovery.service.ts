import { Injectable, type OnModuleInit, type OnModuleDestroy, Inject, Logger } from "@nestjs/common";

import { buildHttpUrl, debugLog, getServerURL, Service } from "../../common";
import { LOAD_BALANCER, LOAD_BALANCING_CONFIGS } from "../constants";
import { FailureTrackerService } from "./failure-tracker.service";
import { ResponseTimeStrategy } from "../loadbalancing";
import { SERVER_INFO, ServerInfo } from "../../client";
import type { LoadBalancingConfigs } from "../types";
import { ILoadBalancer } from "../interfaces";

@Injectable()
export class DiscoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscoveryService.name);
  private instances: Map<string, Service[]> = new Map();
  private refreshIntervalId: NodeJS.Timeout;
  private serverBaseUrl: string;

  constructor(
    @Inject(LOAD_BALANCING_CONFIGS) private readonly loadBalancingConfigs: LoadBalancingConfigs,
    @Inject(LOAD_BALANCER) private readonly loadBalancer: ILoadBalancer,
    @Inject(FailureTrackerService) private readonly failureTracker: FailureTrackerService,
    @Inject(SERVER_INFO) serverInfo: ServerInfo
  ) {
    this.serverBaseUrl = getServerURL(serverInfo);
  }

  async onModuleInit() {
    debugLog("DiscoveryService", "Initializing DiscoveryService...");
    await this.loadInstances();
    this.refreshIntervalId = setInterval(() => this.loadInstances(), this.loadBalancingConfigs.refreshInterval);
  }

  onModuleDestroy() {
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
    }
    debugLog("DiscoveryService", "DiscoveryService stopped");
  }

  /**
   * Refreshes the service registry by fetching the latest instances from the server
   */
  async loadInstances(): Promise<void> {
    debugLog("DiscoveryService", "Refreshing service registry");

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
      this.instances.clear();
      Object.entries(services).forEach(([serviceName, instances]) => {
        // Filter out instances with status OFF
        const activeInstances = instances.filter((instance) => instance.status === "ON");
        if (activeInstances.length > 0) {
          this.instances.set(serviceName, activeInstances);
        }
      });

      // Reset the failure tracker when registry is refreshed
      // This allows failed instances to be tried again after a refresh
      this.failureTracker.resetAll();

      debugLog("DiscoveryService", `Registry refreshed with ${this.instances.size} services`);
    } catch (error) {
      this.logger.error(`Failed to refresh registry: ${error.message}`);
    }
  }

  /**
   * Gets all instances for a specific service
   */
  getInstances(serviceName: string): Service[] {
    return this.instances.get(serviceName) || [];
  }

  /**
   * Gets the URL for a service instance based on the load balancing strategy
   */
  async getServiceUrl(serviceName: string, path = ""): Promise<string> {
    const instances = this.getInstances(serviceName);

    if (!instances || instances.length === 0) {
      throw new Error(`No instances available for service: ${serviceName}`);
    }

    // Get available (non-failed) instances
    const availableInstances = this.failureTracker.getAvailableInstances(instances);

    if (availableInstances.length === 0) {
      throw new Error(`All instances for service ${serviceName} are currently marked as failed`);
    }

    const selectedInstance = this.loadBalancer.selectInstance(availableInstances);

    if (!selectedInstance) {
      throw new Error(`Failed to select an instance for service: ${serviceName}`);
    }

    const baseUrl = buildHttpUrl(selectedInstance.host, selectedInstance.protocol, selectedInstance.port);
    return `${baseUrl}${path}`;
  }

  async executeWithRetry<T>(serviceName: string, callback: (instance: Service) => Promise<T> | T): Promise<T> {
    const instances = this.getInstances(serviceName);

    if (!instances || instances.length === 0) {
      throw new Error(`No instances available for service: ${serviceName}`);
    }

    // Get available (non-failed) instances
    let availableInstances = this.failureTracker.getAvailableInstances(instances);

    if (availableInstances.length === 0) {
      this.logger.warn(`All instances for service ${serviceName} are marked as failed. Trying all instances.`);
      availableInstances = [...instances]; // Try all instances if all are marked as failed
    }

    // Try each instance until success or we run out of instances
    let lastError: Error | null = null;
    const attemptedInstances = new Set<string>();
    const maxRetries = availableInstances.length;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Select an instance that hasn't been tried yet in this request
      const remainingInstances = availableInstances.filter((instance) => !attemptedInstances.has(this.getInstanceId(instance)));

      if (remainingInstances.length === 0) {
        break; // No more instances to try
      }

      const selectedInstance = this.loadBalancer.selectInstance(remainingInstances);

      if (!selectedInstance) {
        break; // No instance selected
      }

      const instanceId = this.getInstanceId(selectedInstance);
      attemptedInstances.add(instanceId);

      // Track connection if strategy supports it
      if (this.loadBalancer.trackConnectionStart) {
        this.loadBalancer.trackConnectionStart(instanceId);
      }

      const startTime = Date.now();

      try {
        const result = await callback(selectedInstance);

        // Record response time for response-time strategy
        if (this.loadBalancer instanceof ResponseTimeStrategy) {
          const responseTime = Date.now() - startTime;
          this.loadBalancer.recordResponseTime(instanceId, responseTime);
        }

        return result;
      } catch (error) {
        this.logger.warn(`Request to instance ${instanceId} failed: ${error.message}`);

        // Mark this instance as temporarily failed
        this.failureTracker.markAsFailed(selectedInstance);

        // Track connection end if strategy supports it
        if (this.loadBalancer.trackConnectionEnd) {
          this.loadBalancer.trackConnectionEnd(instanceId);
        }

        // Apply backoff before trying next instance
        if (attempt < maxRetries - 1) {
          const delay = Math.min(100 * Math.pow(2, attempt), 1000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // If we've tried all available instances and still failed
    throw lastError || new Error(`All instances for service ${serviceName} failed`);
  }

  private getInstanceId(instance: Service): string {
    return `${instance.name}:${instance.host}:${instance.port}`;
  }
}
