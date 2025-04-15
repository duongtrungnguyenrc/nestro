import { Logger } from "@nestjs/common";

import { HttpProtocols, ServiceInstance, WsPRotocols } from "./types";
import { CLASS_REGEX } from "./constants";

function canLog() {
  const isDevelopment = process.env.NODE_ENV != "production";
  const disableLog = process.env.NESTRO_LOG == "off";

  return isDevelopment && !disableLog;
}

export function debugLog(context: string, message: string, data?: any) {
  if (canLog()) {
    if (data) {
      Logger.debug(`${message} - ${JSON.stringify(data)}`, context);
    } else {
      Logger.debug(message, context);
    }
  }
}

export function debugWarn(context: string, message: string, data?: any) {
  if (canLog()) {
    if (data) {
      Logger.warn(`${message} - ${JSON.stringify(data)}`, context);
    } else {
      Logger.warn(message, context);
    }
  }
}

export function debugError(context: string, message: string, data?: any) {
  if (canLog()) {
    if (data) {
      Logger.error(`${message} - ${JSON.stringify(data)}`, context);
    } else {
      Logger.error(message, context);
    }
  }
}

export function normalizeJson(data: object): string {
  return JSON.stringify(data, Object.keys(data).sort(), 0);
}

export function buildInstanceHttpUrl(instance: ServiceInstance) {
  return `${instance.protocol}://${instance.host}${instance.port ? `:${instance.port}` : ""}`;
}

export function buildInstanceWsUrl(instance: ServiceInstance) {
  return `${instance.protocol === "https" ? "wss" : "ws"}://${instance.host}${instance.port ? `:${instance.port}` : ""}`;
}

export function buildHttpUrl(host: string, protocol: HttpProtocols = "http", port?: number) {
  return `${protocol}://${host}${port ? `:${port}` : ""}`;
}

export function buildWsUrl(host: string, protocol: WsPRotocols = "ws", port?: number) {
  return `${protocol}://${host}${port ? `:${port}` : ""}`;
}

export function getHttpSecureProtocol(secure: boolean): HttpProtocols {
  return secure ? "https" : "http";
}

export function isClass(target: any) {
  return typeof target === "function" && CLASS_REGEX.test(Function.prototype.toString.call(target));
}
