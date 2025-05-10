import { Injectable, OnModuleInit, Inject, BeforeApplicationShutdown } from "@nestjs/common";

import { buildHttpUrl, debugLog, normalizeJson, type Service } from "../../common";
import { INSTANCE_INFO, SERVER_INFO } from "../constants";
import { RegisterResponse } from "../../server";
import { KeyService } from "../../security";
import type { ServerInfo } from "../types";

@Injectable()
export class ClientService implements OnModuleInit, BeforeApplicationShutdown {
  private intervalId: NodeJS.Timeout;
  private serverBaseUrl: string;

  constructor(
    @Inject(INSTANCE_INFO) private instanceInfo: Service,
    @Inject(SERVER_INFO) serverInfo: ServerInfo | URL,
    @Inject(KeyService) private readonly keyService: KeyService
  ) {
    this.serverBaseUrl = serverInfo instanceof URL ? serverInfo.toString() : buildHttpUrl(serverInfo.host, serverInfo.protocol, serverInfo.port);
  }

  async onModuleInit() {
    await this.register();
  }

  async beforeApplicationShutdown() {
    debugLog(ClientService.name, "Service stopping, sending deregister service");

    clearInterval(this.intervalId);
    await this.deregister();
  }

  async register() {
    debugLog(ClientService.name, "Registering instanceInfo", this.instanceInfo);

    const signature = this.keyService.signData(this.instanceInfo);

    try {
      const response = await fetch(`${this.serverBaseUrl}/nestro/register`, {
        method: "POST",
        body: normalizeJson(this.instanceInfo),
        headers: {
          "Content-Type": "application/json",
          signature,
        },
      });

      if (response.ok) {
        const data: RegisterResponse = await response.json();

        debugLog(ClientService.name, "Service registered successfully");
        this.intervalId = setInterval(() => this.sendHeartbeat(), data.heartbeatInterval);

        return;
      }

      throw new Error(JSON.stringify(await response.json()));
    } catch (error) {
      console.error("Register error", error.message);
    }
  }

  async sendHeartbeat() {
    debugLog(ClientService.name, "Sending heartbeat", this.instanceInfo);

    const signature = this.keyService.signData(this.instanceInfo);

    try {
      const response = await fetch(`${this.serverBaseUrl}/nestro/heartbeat`, {
        method: "POST",
        body: normalizeJson(this.instanceInfo),
        headers: {
          "Content-Type": "application/json",
          signature,
        },
      });

      if (response.ok) {
        debugLog(ClientService.name, "Heartbeat sent successfully");
        return;
      }

      throw new Error(JSON.stringify(await response.json()));
    } catch (error) {
      console.error("Heartbeat error", error.message);
    }
  }

  async deregister() {
    debugLog(ClientService.name, "Deregistering instanceInfo", this.instanceInfo);

    const signature = this.keyService.signData(this.instanceInfo);

    try {
      const response = await fetch(`${this.serverBaseUrl}/nestro/deregister`, {
        method: "DELETE",
        body: normalizeJson(this.instanceInfo),
        headers: {
          "Content-Type": "application/json",
          signature,
        },
      });
      if (response.ok) {
        debugLog(ClientService.name, "Service deregistered successfully");
        return;
      }

      throw new Error(JSON.stringify(await response.json()));
    } catch (error) {
      console.error("Deregister error", error.message);
    }
  }
}
