import { Controller, Get, Delete, Param, Inject, Render } from "@nestjs/common";

import { RegistryService } from "../services";

@Controller("nestro/dashboard")
export class DashboardController {
  constructor(@Inject(RegistryService) private readonly registryService: RegistryService) {}

  @Get()
  @Render("pages/dashboard")
  async renderDashboardUI() {
    const services = await this.registryService.getServices();

    return {
      services,
      hasServices: Object.keys(services).length > 0,
    };
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
      protocol: "http",
      status: "ON"
    });

    return { success: true };
  }
}
