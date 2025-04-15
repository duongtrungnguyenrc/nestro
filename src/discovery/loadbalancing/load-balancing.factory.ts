import { WeightedRoundRobinStrategy } from "./weighted-round-robin.strategy";
import { LeastConnectionsStrategy } from "./least-connection.strategy";
import { ResponseTimeStrategy } from "./response-time.strategy";
import { RoundRobinStrategy } from "./round-robin.strategy";
import { RandomStrategy } from "./random.strategy";
import { LoadBalancingStrategy } from "../types";
import { ILoadBalancer } from "../interfaces";

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
