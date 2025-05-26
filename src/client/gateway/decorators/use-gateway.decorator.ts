import { Type } from "@nestjs/common";
import "reflect-metadata";

import { GATEWAY_CLASS } from "../constants";

export function UseGateway(gatewayClass: Type<any>) {
  return function (target: any) {
    Reflect.defineMetadata(GATEWAY_CLASS, gatewayClass, target);
  };
}
