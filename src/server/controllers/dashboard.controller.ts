import { Controller, Get, Delete, Param, Res, Inject } from "@nestjs/common";
import { Response } from "express";

import { RegistryService } from "../services";

@Controller("nestro/dashboard")
export class DiscoveryController {
  constructor(@Inject(RegistryService) private readonly registryService: RegistryService) {}

  @Get()
  async renderDiscoveryUI(@Res() res: Response) {
    const services = await this.registryService.getServices();

    return res.render("dashboard", {
      services,
      hasServices: Object.keys(services).length > 0,
    });
  }

  @Get("api/services")
  async getServices() {
    return this.registryService.getServices();
  }

  @Get("api/services/:name")
  async getServicesByName(@Param("name") name: string) {
    const services = await this.registryService.getServices(name);
    return services[name] || [];
  }

  @Delete("api/services/:name/:host/:port")
  async deregisterService(@Param("name") name: string, @Param("host") host: string, @Param("port") port: string) {
    await this.registryService.deregister({
      name,
      host,
      port: parseInt(port, 10),
      protocol: "http", // Skip syntax check
    });

    console.log(`Deregistered service: ${name} (${host}:${port})`);
    return { success: true };
  }
}
