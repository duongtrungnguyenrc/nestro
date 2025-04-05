import {
  CommunicateRequest,
  createCommunicationTemplate,
  LoadBalancingService,
  ServiceInstance,
} from "@duongtrungnguyen/nestro";
import { Injectable } from "@nestjs/common";

@Injectable()
export class CommunicationService extends createCommunicationTemplate("user") {
  constructor(loadBalancingService: LoadBalancingService /* Load balancing service is global dependency*/) {
    // It is used to get the instance of the service
    super(loadBalancingService);
  }

  @CommunicateRequest()
  async getUser(instance: ServiceInstance) {
    // do something with instance
  }
}
