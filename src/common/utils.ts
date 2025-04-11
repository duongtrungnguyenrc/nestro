import { Logger } from "@nestjs/common";

import { HttpProtocols, ServiceInstance, WsPRotocols } from "./types";

const canLog = () => {
  const isDevelopment = process.env.NODE_ENV != "production";
  const disableLog = process.env.NESTRO_LOG == "off";

  return isDevelopment && !disableLog;
};

export const debugLog = (context: string, message: string, data?: any) => {
  if (canLog()) {
    if (data) {
      Logger.debug(`${message} - ${JSON.stringify(data)}`, context);
    } else {
      Logger.debug(message, context);
    }
  }
};

export const debugWarn = (context: string, message: string, data?: any) => {
  if (canLog()) {
    if (data) {
      Logger.warn(`${message} - ${JSON.stringify(data)}`, context);
    } else {
      Logger.warn(message, context);
    }
  }
};

export const debugError = (context: string, message: string, data?: any) => {
  if (canLog()) {
    if (data) {
      Logger.error(`${message} - ${JSON.stringify(data)}`, context);
    } else {
      Logger.error(message, context);
    }
  }
};

export const normalizeJson = (data: object): string => {
  return JSON.stringify(data, Object.keys(data).sort(), 0);
};

export const buildInstanceHttpUrl = (instance: ServiceInstance) =>
  `${instance.protocol}://${instance.host}${instance.port ? `:${instance.port}` : ""}`;

export const buildInstanceWsUrl = (instance: ServiceInstance) =>
  `${instance.protocol === "https" ? "wss" : "ws"}://${instance.host}${instance.port ? `:${instance.port}` : ""}`;

export const buildHttpUrl = (host: string, protocol: HttpProtocols = "http", port?: number) => {
  return `${protocol}://${host}${port ? `:${port}` : ""}`;
};

export const buildWsUrl = (host: string, protocol: WsPRotocols = "ws", port?: number) => {
  return `${protocol}://${host}${port ? `:${port}` : ""}`;
};

export const getHttpSecureProtocol = (secure: boolean): HttpProtocols => {
  return secure ? "https" : "http";
};
