import { Logger } from "@nestjs/common";

import { HttpProtocols } from "./types";

export const debugLog = (context: string, message: string, data?: any) => {
  const logger = new Logger(context);

  const isDevelopment = process.env.NODE_ENV != "production";
  const disableLog = process.env.NESTRO_LOG == "off";

  if (isDevelopment && !disableLog) {
    if (data) {
      logger.debug(`${message} - ${JSON.stringify(data)}`);
    } else {
      logger.debug(message);
    }
  }
};

export const debugWarn = (context: string, message: string, data?: any) => {
  const logger = new Logger(context);

  const isDevelopment = process.env.NODE_ENV != "production";
  const disableLog = process.env.NESTRO_LOG == "off";

  if (isDevelopment && !disableLog) {
    if (data) {
      logger.warn(`${message} - ${JSON.stringify(data)}`);
    } else {
      logger.warn(message);
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
