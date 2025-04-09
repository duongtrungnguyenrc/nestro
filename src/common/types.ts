import { NestExpressApplication } from "@nestjs/platform-express";
import type { Server as CoreHttpsServer } from "https";
import type { Server as CoreHttpServer } from "http";

/**
 * Supported HTTP protocols.
 */
export type HttpProtocols = "http" | "https";

export type InstanceStatus = "ON" | "OFF";

export type InstanceConfig = {
  host: string; // instance host
  port: number; // instance port
  secure: boolean; // communication protocol (http/https)
};

export type InstanceOptions = {
  host: string; // instance host
  port: number; // instance port
  protocol: HttpProtocols; // communication protocol (http/https)
};

/**
 * Represents a service instance with its network details.
 */
export type Service = InstanceOptions & {
  name: string; // Unique service name
  metadata?: Record<string, any>;
};

/**
 * Represents a registered service instance with metadata.
 */
export type ServiceInstance = Service & {
  timestamp: number; // Registration timestamp
  status: InstanceStatus;
  expireAt?: number; // Optional expiration timestamp for service discovery
};

/**
 * Extended NestExpressApplication with an asynchronous listen method.
 */
export type NestroApplication<TServer extends CoreHttpServer | CoreHttpsServer = CoreHttpServer> =
  NestExpressApplication<TServer> & {
    listen: (port?: number) => Promise<TServer>;
  };
