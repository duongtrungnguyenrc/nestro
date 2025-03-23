import { Controller, Post, Delete, Get, Body, Inject } from "@nestjs/common";

import { ServiceDto } from "../../global-types";
import { RegistryService } from "../services";

@Controller("nestro")
export class RegistryController {
  constructor(@Inject(RegistryService) private readonly registryService: RegistryService) {}

  @Post("register")
  async register(@Body() service: ServiceDto) {
    await this.registryService.register(service);
    return { message: "Registered" };
  }

  @Delete("deregister")
  async deregister(@Body() service: ServiceDto) {
    await this.registryService.deregister(service);
    return { message: "Deregistered" };
  }

  @Post("heartbeat")
  async heartbeat(@Body() service: ServiceDto) {
    await this.registryService.heartbeat(service);
    return { message: "Heartbeat received" };
  }

  @Get("services")
  async getServices() {
    return await this.registryService.getServices();
  }
}
