/**
 * Load balancing strategies.
 */
export type LoadBalancingStrategy =
  | "random" // Randomly selects an instance
  | "round-robin" // Distributes requests evenly across instances
  | "least-connections" // Selects the instance with the least active connections
  | "weighted-round-robin" // Distributes requests based on instance weights
  | "response-time"; // Selects the instance with the fastest response time

export type LoadBalancingConfigs = {
  strategy?: LoadBalancingStrategy; // Load balancing strategy, default is round robin
  refreshInterval?: number; // Instance refresh interval
  maxRetries?: number; // Maximum retry limit for failed instances
};
