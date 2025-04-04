import { LoadBalancingStrategy } from "./types";

export const LOAD_BALANCER = "LOAD_BALANCER";
export const LOAD_BALANCING_CONFIGS = "LOAD_BALANCING_CONFIGS";

export const DEFAULT_LOAD_BALANCING_REFRESH_INTERVAL = 30 * 1000;
export const DEFAULT_LOAD_BALANCING_STRATEGY: LoadBalancingStrategy = "round-robin";
