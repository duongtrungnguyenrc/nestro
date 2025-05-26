import { RawBodyRequest } from "@nestjs/common";
import { Request, Response } from "express";

import { GatewayService } from "../services";
import { ProxyOptions } from "../types";

export function ProxyForward(options?: ProxyOptions): MethodDecorator {
  return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
    descriptor.value = async function (...args: any[]) {
      const req: RawBodyRequest<Request> | null = args.find((arg) => arg?.headers && arg?.url);
      const res: Response | null = args.find((arg) => typeof arg?.status === "function" && typeof arg?.json === "function");

      if (!req || !res) {
        throw new Error("@Proxy() method must have access to req and res (e.g., with @Req() and @Res())");
      }

      if (!req.rawBody) {
        throw new Error("Require raw body request to proxy");
      }
      const gatewayInstance = Object.values(this).find((value) => value instanceof GatewayService);

      if (!gatewayInstance) {
        throw new Error("No property found that is instance of GatewayTemplate");
      }

      return this._gatewayService.executeWithOptions(req, res, options);
    };

    return descriptor;
  };
}
