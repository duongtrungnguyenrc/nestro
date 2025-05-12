import { DiscoveryService } from "../discovery";

export abstract class CommunicationTemplate {
  _discoveryService: DiscoveryService;
  targetService: string;

  constructor(discoveryService: DiscoveryService, targetService: string) {
    this._discoveryService = discoveryService;
    this.targetService = targetService;
  }
}
