import { RawBodyRequest } from "@nestjs/common";
import { Request, Response } from "express";

import { ProxyOptions } from "../types";

export function Proxy(options?: ProxyOptions) {
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

      if (!this._proxyService) {
        throw new Error("Missing _proxyService on class. Ensure it extends ProxyTemplate.");
      }

      return this._proxyService.executeWithOptions(req, res, options);
    };

    return descriptor;
  };
}
