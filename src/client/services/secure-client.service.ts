import { Injectable, OnModuleInit, Inject, BeforeApplicationShutdown } from "@nestjs/common";

import { getServerURL, normalizeJson, type Service } from "../../common";
import { INSTANCE_INFO, SERVER_INFO } from "../constants";
import { RegisterResponse } from "../../server";
import { IClientService } from "../interfaces";
import { KeyService } from "../../security";
import type { ServerInfo } from "../types";

@Injectable()
export class SecureClientService implements IClientService, OnModuleInit, BeforeApplicationShutdown {
  private intervalId: NodeJS.Timeout;
  private serverBaseUrl: string;

  constructor(
    @Inject(INSTANCE_INFO) private instanceInfo: Service,
    @Inject(SERVER_INFO) serverInfo: ServerInfo | URL,
    @Inject(KeyService) private readonly keyService: KeyService
  ) {
    this.serverBaseUrl = getServerURL(serverInfo);
  }

  async onModuleInit() {
    await this.register();
  }

  async beforeApplicationShutdown() {
    clearInterval(this.intervalId);
    await this.deregister();
  }

  private getSignedHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      signature: this.keyService.signData(this.instanceInfo),
    };
  }

  async register() {
    const response = await fetch(`${this.serverBaseUrl}/nestro/register`, {
      method: "POST",
      body: normalizeJson(this.instanceInfo),
      headers: this.getSignedHeaders(),
    });
    const data: RegisterResponse = await response.json();
    this.intervalId = setInterval(() => this.sendHeartbeat(), data.heartbeatInterval);
  }

  async sendHeartbeat() {
    await fetch(`${this.serverBaseUrl}/nestro/heartbeat`, {
      method: "POST",
      body: normalizeJson(this.instanceInfo),
      headers: this.getSignedHeaders(),
    });
  }

  async deregister() {
    await fetch(`${this.serverBaseUrl}/nestro/deregister`, {
      method: "DELETE",
      body: normalizeJson(this.instanceInfo),
      headers: this.getSignedHeaders(),
    });
  }
}
