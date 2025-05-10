import { DiscoveryService } from "../../discovery";
import { CommunicationTemplate } from "../utils";
import { type Service } from "../../common";

export function CommunicateRequest(serviceName?: string) {
  return function (_: any, __: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      if (!this._discoveryService && !(this._discoveryService instanceof DiscoveryService)) {
        throw new Error("Missing _discoveryService on class. Ensure it extends CommunicationTemplate.");
      }

      return (this as CommunicationTemplate)?._discoveryService.executeWithRetry(serviceName || this.targetService, async (instance: Service) => {
        return await originalMethod.apply(this, [instance, ...args]);
      });
    };

    return descriptor;
  };
}
