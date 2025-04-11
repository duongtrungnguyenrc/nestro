import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from "@nestjs/common";

import { buildHttpUrl, debugLog, normalizeJson } from "../../common";
import { INSTANCE_INFO, SERVER_INFO } from "../constants";
import type { ServerInfo, InstanceInfo } from "../types";
import { RegisterResponse } from "../../server";
import { KeyService } from "../../security";

@Injectable()
export class ClientService implements OnModuleInit, OnModuleDestroy {
  private intervalId: NodeJS.Timeout;
  private serverBaseUrl: string;

  constructor(
    @Inject(INSTANCE_INFO) private instanceInfo: InstanceInfo,
    @Inject(SERVER_INFO) private readonly serverInfo: ServerInfo,
    @Inject(KeyService) private readonly keyService: KeyService
  ) {
    this.serverBaseUrl = buildHttpUrl(this.serverInfo.host, this.serverInfo.protocol, this.serverInfo.port);
  }

  async onModuleInit() {
    await this.register();
  }

  async onModuleDestroy() {
    clearInterval(this.intervalId);
    await this.deregister();
    debugLog("ClientService", "ClientService stopped");
  }

  async register() {
    debugLog("ClientService", "Registering instanceInfo", this.instanceInfo);

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

        debugLog("ClientService", "Service registered successfully");
        this.intervalId = setInterval(() => this.sendHeartbeat(), data.heartbeatInterval);

        return;
      }

      throw new Error(JSON.stringify(await response.json()));
    } catch (error) {
      console.error("Register error", error.message);
    }
  }

  async sendHeartbeat() {
    debugLog("ClientService", "Sending heartbeat", this.instanceInfo);

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
        debugLog("ClientService", "Heartbeat sent successfully");
        return;
      }

      throw new Error(JSON.stringify(await response.json()));
    } catch (error) {
      console.error("Heartbeat error", error.message);
    }
  }

  async deregister() {
    debugLog("ClientService", "Deregistering instanceInfo", this.instanceInfo);

    const signature = this.keyService.signData(this.instanceInfo);

    try {
      const response = await fetch(`${this.serverBaseUrl}/nestro/deregister`, {
        method: "POST",
        body: normalizeJson(this.instanceInfo),
        headers: {
          "Content-Type": "application/json",
          signature,
        },
      });
      if (response.ok) {
        debugLog("ClientService", "Service deregistered successfully");
        return;
      }

      throw new Error(JSON.stringify(await response.json()));
    } catch (error) {
      console.error("Deregister error", error.message);
    }
  }
}
