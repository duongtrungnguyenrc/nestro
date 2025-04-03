import type { LoadBalancingStrategy } from "../common/types";
import type { LoadBalancingRetryOptions } from "./types";

export const INSTANCE_INFO = "CLIENT_OPTIONS";
export const SERVER_INFO = "SERVER_INFO";
export const INSTANCES = "INSTANCES";
export const RETRY_OPTIONS = "RETRY_OPTIONS";
export const CLIENT_LOADBALANCING_OPTION = "CLIENT_LOADBALANCING_OPTION";
export const PROXY_ROUTES_CONFIG = "PROXY_ROUTES";

export const DEFAULT_HEARBEAT_INTERVAL = 30 * 1000;
export const DEFAULT_CLEANUP_TTL = 10 * 1000;
export const DEFAULT_LOAD_BALANCING_REFRESH_INTERVAL = 30 * 1000;
export const DEFAULT_LOAD_BALANCING_STRATEGY: LoadBalancingStrategy = "round-robin";
export const DEFAULT_HOST = "localhost";
export const DEFAULT_SERVER_PORT = 4444;
export const DEFAULT_CLIENT_PROTOCOL = "http";

export const DEFAULT_RETRY_OPTIONS: LoadBalancingRetryOptions = {
  maxRetryCount: 5,
  initialBackoffMs: 1000,
  maxBackoffMs: 60000,
  backoffMultiplier: 2,
  resetTimeoutMs: 60000 * 5,
};
