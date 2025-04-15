import { NestExpressApplication } from "@nestjs/platform-express";
import type { Server as CoreHttpsServer } from "https";
import type { Server as CoreHttpServer } from "http";

/**
 * Supported HTTP protocols.
 */
export type HttpProtocols = "http" | "https";

export type WsPRotocols = "wss" | "ws";

export type InstanceStatus = "ON" | "OFF";

/**
 * Represents the configuration settings for an instance.
 *
 * @property host - The hostname or IP address of the instance.
 * @property port - The port number on which the instance is running.
 * @property secure - Indicates whether the communication protocol is secure (true for HTTPS, false for HTTP).
 */
export type InstanceConfig = {
  host: string; // instance host
  port: number; // instance port
  secure: boolean; // communication protocol (http/https)
};

/**
 * Represents the configuration options for an instance.
 *
 * @property host - The host address of the instance.
 * @property port - The port number used by the instance.
 * @property protocol - The communication protocol (e.g., HTTP or HTTPS).
 */
export type InstanceOptions = {
  host: string; // instance host
  port: number; // instance port
  protocol: HttpProtocols; // communication protocol (http/https)
};

/**
 * Represents a service with a unique name and optional metadata.
 * Extends the `InstanceOptions` type.
 *
 * @property name - Unique service name.
 * @property metadata - Optional metadata associated with the service, represented as a record of key-value pairs.
 */
export type Service = InstanceOptions & {
  name: string; // Unique service name
  metadata?: Record<string, any>;
};

/**
 * Represents a service instance with additional metadata.
 *
 * @extends Service
 *
 * @property {InstanceStatus} status - The current status of the service instance.
 * @property {number} timestamp - The timestamp indicating when the instance was created or updated.
 * @property {number} lastHeartbeatAt - The timestamp of the last received heartbeat from the instance.
 * @property {number} missedHeartbeats - The number of consecutive heartbeats that have been missed.
 */
export type ServiceInstance = Service & {
  status: InstanceStatus;
  timestamp: number;
  lastHeartbeatAt: number;
  missedHeartbeats: number;
};

/**
 * Represents a specialized NestJS application with extended functionality for
 * handling HTTP or HTTPS servers. This type extends the `NestExpressApplication`
 * and provides a custom `listen` method that returns a promise resolving to the
 * underlying server instance.
 *
 * @template TServer - The type of the server, which can be either `CoreHttpServer`
 * or `CoreHttpsServer`. Defaults to `CoreHttpServer`.
 */
export type NestroApplication<TServer extends CoreHttpServer | CoreHttpsServer = CoreHttpServer> = NestExpressApplication<TServer> & {
  listen: (port?: number) => Promise<TServer>;
};
