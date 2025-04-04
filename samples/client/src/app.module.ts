import { Module } from "@nestjs/common";

import { GatewayModule } from "./gateway";
import { CommunicationModule } from './communication/communication.module';

@Module({
  imports: [GatewayModule, CommunicationModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
