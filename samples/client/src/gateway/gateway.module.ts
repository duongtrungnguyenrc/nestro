import { ProxyModule } from "@duongtrungnguyen/nestro";
import { Module } from "@nestjs/common";

import { GatewayConfig } from "./gateway.config";

@Module({
  imports: [ProxyModule.config(GatewayConfig)],
})
export class GatewayModule {}
