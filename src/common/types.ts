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
 * @property openapiEndpoint - Optional. The endpoint for the OpenAPI specification.
 */
export type Instance = {
  host: string; // instance host
  port: number; // instance port
  metadata?: Record<string, any>; // instance metadata
  swaggerJsonPath?: string;
};

/**
 * Represents the configuration options for a service.
 *
 * @remarks
 * This type extends a partial {@link Instance} and adds additional properties specific to service configuration.
 *
 * @property name - Unique service name.
 * @property secure - Optional. Indicates whether the communication protocol is secure (https) or not (http).
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
 * @property status - The instance status of service (ON, OFF)
 */
export type Service = Instance & {
  name: string;
  protocol: HttpProtocols;
  status: InstanceStatus;
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
