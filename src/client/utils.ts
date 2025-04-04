import { LoadBalancingService } from "../loadbalancing";

export class CommunicationTemplate {
  protected readonly service: LoadBalancingService;

  constructor(service: LoadBalancingService) {
    this.service = service;
  }
}
