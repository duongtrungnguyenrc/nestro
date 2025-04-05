import { LoadBalancingService } from "../loadbalancing";

export const createCommunicationTemplate = (target: string) => {
  return class CommunicationTemplate {
    readonly service: LoadBalancingService;
    readonly targetService: string = target;

    constructor(service: LoadBalancingService) {
      this.service = service;
    }
  };
};
