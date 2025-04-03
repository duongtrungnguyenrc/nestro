import { NestExpressApplication } from "@nestjs/platform-express";
import { Server } from "http";

/**
 * Supported HTTP protocols.
 */
export type HttpProtocols = "http" | "https";

/**
 * Load balancing strategies.
 */
export type LoadBalancingStrategy =
  | "random" // Selects a random instance
  | "round-robin" // Distributes requests sequentially
  | "least-connections"; // Routes to the instance with the fewest active connections

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
};

/**
 * Represents a registered service instance with metadata.
 */
export type ServiceInstance = Service & {
  timestamp: number; // Registration timestamp
  status: InstanceStatus;
  expireAt?: number; // Optional expiration timestamp for service discovery
  metadata?: Record<string, any>;
};

/**
 * Extended NestExpressApplication with an asynchronous listen method.
 */
export type NestroApplication = NestExpressApplication & {
  listen: (port?: number) => Promise<Server>;
};
