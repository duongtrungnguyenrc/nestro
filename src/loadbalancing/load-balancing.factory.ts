import {
  LeastConnectionsStrategy,
  RandomStrategy,
  ResponseTimeStrategy,
  RoundRobinStrategy,
  WeightedRoundRobinStrategy,
} from "./strategies";
import { ILoadBalancer } from "./interfaces";
import { LoadBalancingStrategy } from "./types";

export class LoadBalancingFactory {
  static getStrategy(strategyType: LoadBalancingStrategy): ILoadBalancer {
    switch (strategyType) {
      case "random":
        return new RandomStrategy();
      case "round-robin":
        return new RoundRobinStrategy();
      case "least-connections":
        return new LeastConnectionsStrategy();
      case "weighted-round-robin":
        return new WeightedRoundRobinStrategy();
      case "response-time":
        return new ResponseTimeStrategy();
      default:
        return new RoundRobinStrategy();
    }
  }
}
