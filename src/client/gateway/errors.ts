import { HttpStatus } from "@nestjs/common";

export enum ProxyErrorType {
  CONNECTION_FAILED = "CONNECTION_FAILED",
  TIMEOUT = "TIMEOUT",
  TARGET_NOT_FOUND = "TARGET_NOT_FOUND",
  INVALID_RESPONSE = "INVALID_RESPONSE",
  NETWORK_ERROR = "NETWORK_ERROR",
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
  UNKNOWN = "UNKNOWN",
}

export class ProxyError extends Error {
  private readonly timestamp = new Date();

  constructor(message: string, public readonly type: ProxyErrorType, public readonly statusCode: number = HttpStatus.SERVICE_UNAVAILABLE) {
    super(message);
    this.name = "ProxyError";
  }

  toJson() {
    return JSON.stringify({
      message: this.message,
      timestamp: this.timestamp,
      statusCode: this.statusCode,
    });
  }
}
