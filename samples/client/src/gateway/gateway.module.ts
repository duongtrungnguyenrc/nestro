import { ProxyModule } from "@duongtrungnguyen/nestro";
import { Module } from "@nestjs/common";

@Module({
  imports: [
    ProxyModule.builder()
      .route({
        route: "/user/*", // Route to match
        retryLimit: 1, // Retry limit for the request
        target: "user", // Target service name
        rewritePath: (path) => path.replace("/user", ""), // Rewrite path
      })
      .build(),
  ],
})
export class GatewayModule {}
