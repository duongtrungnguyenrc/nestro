import { GatewayModule } from "@duongtrungnguyen/nestro";
import { Module } from "@nestjs/common";

import { GatewayConfig } from "./gateway.config";

@Module({
  imports: [GatewayModule.config(GatewayConfig)],
})
export class GatewayModule {}
