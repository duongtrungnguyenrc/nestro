import { ClientLoadBalancerService } from "../services";
import type { ExecuteRequestOptions } from "../types";
import type { ServiceInstance } from "../../common";

export function CommunicateRequest(serviceName: string, options: ExecuteRequestOptions = {}) {
  return function (_: any, __: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const loadBalancer: ClientLoadBalancerService = this.loadBalancer;
      const { retryOnFailure = true, maxRetries = 3 } = options;

      let retries = 0;
      let lastError: any;

      while (retries <= maxRetries) {
        const instance: ServiceInstance | null = loadBalancer.getNextInstance(serviceName);

        if (!instance) {
          throw new Error(`No available instances for service: ${serviceName}`);
        }

        try {
          return await originalMethod.apply(this, [instance, ...args]);
        } catch (error) {
          lastError = error;
          loadBalancer.markInstanceFailed(serviceName, instance);

          if (retryOnFailure && retries < maxRetries) {
            retries++;
            continue;
          }

          throw error;
        }
      }

      throw lastError;
    };

    return descriptor;
  };
}
