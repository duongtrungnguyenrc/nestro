import { applyDecorators, UseInterceptors } from "@nestjs/common";

import { ProxyInterceptor } from "./proxy.interceptor";
import { ProxyOptions } from "./types";

/**
 * Decorator to proxy requests to a target server
 * @param options Proxy options
 */
export function Proxy(options: ProxyOptions) {
  return applyDecorators(UseInterceptors(new ProxyInterceptor(options)));
}
