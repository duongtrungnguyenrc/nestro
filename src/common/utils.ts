import { Logger } from "@nestjs/common";

import { HttpProtocols } from "./types";

const isDevelopment = process.env.NODE_ENV != "production";
const disableLog = process.env.NESTRO_LOG == "off";
const canLog = isDevelopment && !disableLog;

export const debugLog = (context: string, message: string, data?: any) => {
  if (canLog) {
    if (data) {
      Logger.debug(`${message} - ${JSON.stringify(data)}`, context);
    } else {
      Logger.debug(message, context);
    }
  }
};

export const debugWarn = (context: string, message: string, data?: any) => {
  if (canLog) {
    if (data) {
      Logger.warn(`${message} - ${JSON.stringify(data)}`, context);
    } else {
      Logger.warn(message, context);
    }
  }
};

export const debugError = (context: string, message: string, data?: any) => {
  if (canLog) {
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

export const buildUrl = (host: string, protocol: HttpProtocols = "http", port?: number) => {
  return `${protocol}://${host}${port ? `:${port}` : ""}`;
};

export const getSecureProtocol = (secure: boolean): HttpProtocols => {
  return secure ? "https" : "http";
};
