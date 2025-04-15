import { DiscoveryService } from "../discovery";

export abstract class CommunicationTemplate {
  _discoveryService: DiscoveryService;

  constructor(discoveryService: DiscoveryService) {
    this._discoveryService = discoveryService;
  }
}

export const createCommunicationTemplate = (target: string) => {
  return class CommunicationTemplateWithService extends CommunicationTemplate {
    targetService: string = target;

    constructor(discoveryService: DiscoveryService) {
      super(discoveryService);
    }
  };
};
