import { Logger } from "@nestjs/common";

export const debugLog = (context: string, message: string, data?: any) => {
  const logger = new Logger(context);

  const isDevelopment = process.env.NODE_ENV != "production";

  if (isDevelopment) {
    if (data) {
      logger.debug(`${message} - ${JSON.stringify(data)}`);
    } else {
      logger.debug(message);
    }
  }
};

export const normalizeJson = (data: object): string => {
  return JSON.stringify(data, Object.keys(data).sort(), 0);
};

export const buildUrl = (host: string, protocol: HttpProtocols = "http", port?: number) => {
  return `${protocol}://${host}${port ? `:${port}` : ""}`;
};
