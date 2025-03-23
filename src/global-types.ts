export type HttpProtocols = "http" | "https";

export type LoadBalancingStrategy = "random" | "round-robin" | "least-connections" | "ip-hash";

export type ServiceDto = {
  name: string;
  host: string;
  port?: number;
  protocol?: HttpProtocols;
};
