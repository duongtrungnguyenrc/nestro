import { DiscoveryService } from "../discovery";

export abstract class CommunicationTemplate {
  _discoveryService: DiscoveryService;
  serviceName: string;

  constructor(discoveryService: DiscoveryService, serviceName: string) {
    this._discoveryService = discoveryService;
    this.serviceName = serviceName;
  }
}
