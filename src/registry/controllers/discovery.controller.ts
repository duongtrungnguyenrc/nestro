import { Controller, Get, Delete, Param, Res, Inject } from "@nestjs/common";
import { Response } from "express";

import { RegistryService } from "../services";

@Controller("nestro/discovery")
export class DiscoveryController {
  constructor(@Inject(RegistryService) private readonly registryService: RegistryService) {}

  @Get()
  async renderDiscoveryUI(@Res() res: Response) {
    const services = await this.registryService.getServices();

    const serviceGroups = services.reduce((acc, service) => {
      if (!acc[service.name]) {
        acc[service.name] = [];
      }
      acc[service.name].push(service);
      return acc;
    }, {});

    return res.render("discovery", {
      serviceGroups,
      hasServices: Object.keys(serviceGroups).length > 0,
    });
  }

  @Get("api/services")
  async getServices() {
    return this.registryService.getServices();
  }

  @Get("api/services/:name")
  async getServicesByName(@Param("name") name: string) {
    return this.registryService.getServices(name);
  }

  @Delete("api/services/:name/:host/:port")
  async deregisterService(@Param("name") name: string, @Param("host") host: string, @Param("port") port: string) {
    await this.registryService.deregister({
      name,
      host,
      port: parseInt(port, 10),
    });
    return { success: true };
  }
}
