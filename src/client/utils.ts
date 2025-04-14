import { LoadBalancingService } from "../loadbalancing";

export abstract class CommunicationTemplate {
  service: LoadBalancingService;

  constructor(service: LoadBalancingService) {
    this.service = service;
  }
}

export const createCommunicationTemplate = (target: string) => {
  return class CommunicationTemplateWithService extends CommunicationTemplate {
    targetService: string = target;

    constructor(service: LoadBalancingService) {
      super(service);
    }
  };
};
