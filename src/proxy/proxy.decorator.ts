import { applyDecorators, UseInterceptors } from "@nestjs/common";
import { ProxyOptions } from "./types";
import { ProxyInterceptor } from "./proxy.interceptor";

/**
 * Decorator to proxy requests to a target server
 * @param options Proxy options
 */
export function Proxy(options: ProxyOptions) {
  return applyDecorators(UseInterceptors(new ProxyInterceptor(options)));
}
