import { IGatewayConfig, ProxyModuleBuilder } from "@duongtrungnguyen/nestro";
import { DynamicModule, RequestMethod } from "@nestjs/common";

import { AuthGuard } from "./auth.guard";

export class GatewayConfig implements IGatewayConfig {
  build(builder: ProxyModuleBuilder): DynamicModule {
    return builder
      .httpRoute({
        route: "/user/*path", // Route pattern
        service: "user", // Service name
        pathRewrite: { "^/api/user": "/" }, // Rewrite path
        requestHooks: {
          guards: [
            {
              instance: AuthGuard,
              excludes: [
                {
                  path: "/user/refresh",
                  method: RequestMethod.POST,
                },
                {
                  path: "/user/login",
                  method: RequestMethod.POST,
                },
              ],
            },
          ],
          middlewares: [], // Middlewares
        },
      })
      .build();
  }
}
