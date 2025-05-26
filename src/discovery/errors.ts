export enum DiscoveryErrorCode {
  SERVICE_NOT_FOUND = "SERVICE_NOT_FOUND",
  ALL_INSTANCES_FAILED = "ALL_INSTANCES_FAILED",
}

export class DiscoveryError extends Error {
  constructor(public readonly message: string, public readonly code: DiscoveryErrorCode) {
    super(message);
  }
}
