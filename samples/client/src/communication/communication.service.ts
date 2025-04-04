import {
  CommunicateRequest,
  CommunicationTemplate,
  LoadBalancingService,
  ServiceInstance,
} from "@duongtrungnguyen/nestro";
import { Injectable } from "@nestjs/common";

@Injectable()
export class CommunicationService extends CommunicationTemplate {
  constructor(loadBalancingService: LoadBalancingService /* Load balancing service is global dependency*/) {
    // It is used to get the instance of the service
    super(loadBalancingService);
  }

  @CommunicateRequest("user")
  async getUser(instance: ServiceInstance) {
    // do something with instance
  }
}
