import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";

import { buildUrl, debugLog, normalizeJson } from "../../utils";
import { ClientServiceOptions } from "../types";
import { ServiceDto } from "../../global-types";
import { KeyService } from "../../security";

@Injectable()
export class ClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClientService.name);
  private intervalId: NodeJS.Timeout;
  private service: ServiceDto;

  constructor(private options: ClientServiceOptions, private readonly keyService: KeyService) {
    this.service = {
      ...this.options.client,
    };
  }

  async onModuleInit() {
    debugLog("ClientService", "Initializing ClientService...");
    await this.register();
    this.intervalId = setInterval(() => this.sendHeartbeat(), this.options.heartbeatInterval);
  }

  async onModuleDestroy() {
    clearInterval(this.intervalId);
    await this.deregister();
    debugLog("ClientService", "ClientService stopped");
  }

  async register() {
    debugLog("ClientService", "Registering service", this.service);

    const signature = this.keyService.signData(this.service);

    try {
      const response = await fetch(
        `${buildUrl(this.options.nestro.host, this.options.nestro.protocol, this.options.nestro.port)}/nestro/register`,
        {
          method: "POST",
          body: normalizeJson(this.service),
          headers: {
            "Content-Type": "application/json",
            signature,
          },
        }
      );

      if (response.ok) {
        debugLog("ClientService", "Service registered successfully");
        return;
      }

      throw new Error(JSON.stringify(await response.json()));
    } catch (error) {
      this.logger.error("Register error", error.message);
    }
  }

  async sendHeartbeat() {
    debugLog("ClientService", "Sending heartbeat", this.service);

    const signature = this.keyService.signData(this.service);

    try {
      const response = await fetch(
        `${buildUrl(
          this.options.nestro.host,
          this.options.nestro.protocol,
          this.options.nestro.port
        )}/nestro/heartbeat`,
        {
          method: "POST",
          body: normalizeJson(this.service),
          headers: {
            "Content-Type": "application/json",
            signature,
          },
        }
      );

      if (response.ok) {
        debugLog("ClientService", "Heartbeat sent successfully");
        return;
      }

      throw new Error(JSON.stringify(await response.json()));
    } catch (error) {
      this.logger.error("Heartbeat error", error.message);
    }
  }

  async deregister() {
    debugLog("ClientService", "Deregistering service", this.service);

    const signature = this.keyService.signData(this.service);

    try {
      const response = await fetch(
        `${buildUrl(
          this.options.nestro.host,
          this.options.nestro.protocol,
          this.options.nestro.port
        )}/nestro/deregister`,
        {
          method: "POST",
          body: normalizeJson(this.service),
          headers: {
            "Content-Type": "application/json",
            signature,
          },
        }
      );
      if (response.ok) {
        debugLog("ClientService", "Service deregistered successfully");
        return;
      }

      throw new Error(JSON.stringify(await response.json()));
    } catch (error) {
      this.logger.error("Deregister error", error.message);
    }
  }
}
