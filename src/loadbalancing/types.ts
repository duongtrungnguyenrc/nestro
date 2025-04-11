/**
 * Represents the available strategies for load balancing in a system.
 *
 * - `"random"`: Randomly selects an instance for handling the request.
 * - `"round-robin"`: Distributes requests evenly across all available instances in a cyclic manner.
 * - `"least-connections"`: Selects the instance with the fewest active connections at the time of the request.
 * - `"weighted-round-robin"`: Distributes requests based on predefined weights assigned to each instance.
 * - `"response-time"`: Selects the instance with the fastest response time, optimizing for latency.
 */
export type LoadBalancingStrategy =
  | "random" // Randomly selects an instance
  | "round-robin" // Distributes requests evenly across instances
  | "least-connections" // Selects the instance with the least active connections
  | "weighted-round-robin" // Distributes requests based on instance weights
  | "response-time"; // Selects the instance with the fastest response time


/**
 * Configuration options for load balancing.
 *
 * @property strategy - The load balancing strategy to use. Defaults to round robin if not specified.
 * @property refreshInterval - The interval (in milliseconds) at which instances are refreshed.
 * @property maxRetries - The maximum number of retry attempts for failed instances.
 */
export type LoadBalancingConfigs = {
  strategy?: LoadBalancingStrategy; // Load balancing strategy, default is round robin
  refreshInterval?: number; // Instance refresh interval
  maxRetries?: number; // Maximum retry limit for failed instances
};
