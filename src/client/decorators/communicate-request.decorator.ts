import { type ServiceInstance } from "../../common";

export function CommunicateRequest(serviceName: string) {
  return function (_: any, __: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return this?.service.executeWithRetry(serviceName, async (instance: ServiceInstance) => {
        return await originalMethod.apply(this, [instance, ...args]);
      });
    };

    return descriptor;
  };
}
