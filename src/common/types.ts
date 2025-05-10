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
 * Represents an instance with connection details and optional metadata.
 *
 * @property host - The hostname or IP address of the instance.
 * @property port - The port number used to connect to the instance.
 * @property metadata - Optional key-value pairs containing additional information about the instance.
 */
export type Instance = {
  host: string; // instance host
  port: number; // instance port
  metadata?: Record<string, any>; // instance metadata
};

/**
 * Represents the configuration for a service.
 *
 * @extends Partial<Instance>
 *
 * @property {string} name - Unique service name.
 * @property {boolean} [secure] - Indicates the communication protocol.
 *                                If true, uses HTTPS; otherwise, uses HTTP.
 */
export type ServiceConfig = Partial<Instance> & {
  name: string; // Unique service name
  secure?: boolean; // communication protocol (http/https)
};

/**
 * Represents a service with a unique name and communication protocol.
 * Extends the `Instance` type.
 *
 * @property name - The unique name of the service.
 * @property protocol - The communication protocol used by the service (e.g., HTTP or HTTPS).
 */
export type Service = Instance & {
  name: string; // Unique service name
  protocol: HttpProtocols; // communication protocol (http/https)
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
export type ServiceInfo = Service & {
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
