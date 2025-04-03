import { Controller, Post, Delete, Get, Body, Inject } from "@nestjs/common";

import { RegistryService } from "../services";
import { Service } from "../../common";

@Controller("nestro")
export class RegistryController {
  constructor(@Inject(RegistryService) private readonly registryService: RegistryService) {}

  @Post("register")
  async register(@Body() service: Service) {
    await this.registryService.register(service);
    return { message: "Registered" };
  }

  @Delete("deregister")
  async deregister(@Body() service: Service) {
    await this.registryService.deregister(service);
    return { message: "Deregistered" };
  }

  @Post("heartbeat")
  async heartbeat(@Body() service: Service) {
    await this.registryService.heartbeat(service);
    return { message: "Heartbeat received" };
  }

  @Get("services")
  async getServices() {
    return await this.registryService.getServices();
  }
}
