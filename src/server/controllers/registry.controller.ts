import { Controller, Post, Delete, Get, Body, Inject } from "@nestjs/common";

import { RegistryService } from "../services";
import { Service } from "../../common";

@Controller("nestro")
export class RegistryController {
  constructor(@Inject(RegistryService) private readonly registryService: RegistryService) {}

  @Post("register")
  async register(@Body() service: Service) {
    return await this.registryService.register(service);
  }

  @Delete("deregister")
  async deregister(@Body() service: Service) {
    return await this.registryService.deregister(service);
  }

  @Post("heartbeat")
  async heartbeat(@Body() service: Service) {
    return await this.registryService.heartbeat(service);
  }

  @Get("services")
  async getServices() {
    return await this.registryService.getServices();
  }
}
