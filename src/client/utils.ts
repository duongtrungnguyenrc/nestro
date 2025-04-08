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

export class CommunicationTemplate {
  readonly service: LoadBalancingService;

  constructor(service: LoadBalancingService) {
    this.service = service;
  }
}
