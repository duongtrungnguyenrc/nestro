import {
  CommunicateRequest,
  createCommunicationTemplate,
  DiscoveryService,
  ServiceInstance,
} from "@duongtrungnguyen/nestro";
import { Injectable } from "@nestjs/common";

@Injectable()
export class CommunicationService extends createCommunicationTemplate("user") {
  constructor(discoveryService: DiscoveryService /* Load balancing service is global dependency*/) {
    // It is used to get the instance of the service
    super(discoveryService);
  }

  @CommunicateRequest()
  async getUser(instance: ServiceInstance) {
    // do something with instance
  }
}
