import { IncomingMessage } from "http";
import { URL } from "url";
import { OutgoingOptions, ProxyOptions, ProxyTarget } from "./types";
import { Logger } from "@nestjs/common";

// Regular expressions - compiled once for performance
const UPGRADE_HEADER_REGEX = /(^|,)\s*upgrade\s*($|,)/i;
export const SSL_PROTOCOL_REGEX = /^https|wss/;

/**
 * Set up outgoing request options
 */
export function setupOutgoing(
  outgoing: OutgoingOptions = {},
  options: ProxyOptions,
  req: IncomingMessage,
  forward?: string
): OutgoingOptions {
  const targetKey = forward || "target";
  if (!options[targetKey]) {
    return outgoing;
  }

  const target = options[targetKey] as URL | ProxyTarget;

  // Set port
  if ((target as ProxyTarget).port) {
    outgoing.port = (target as ProxyTarget).port;
  } else if ((target as URL).port) {
    outgoing.port = parseInt((target as URL).port, 10);
  } else {
    outgoing.port = SSL_PROTOCOL_REGEX.test((target as URL).protocol || "") ? 443 : 80;
  }

  // Copy properties from target
  const targetProps = [
    "host",
    "hostname",
    "socketPath",
    "pfx",
    "key",
    "passphrase",
    "cert",
    "ca",
    "ciphers",
    "secureProtocol",
  ];

  for (const prop of targetProps) {
    if ((target as any)[prop] !== undefined) {
      (outgoing as any)[prop] = (target as any)[prop];
    }
  }

  // Set method and headers
  outgoing.method = req.method || "GET";
  outgoing.headers = { ...req.headers };

  // Add custom headers
  if (options.headers) {
    Object.assign(outgoing.headers, options.headers);
  }

  // Set auth if provided
  if (options.auth) {
    outgoing.auth =
      typeof options.auth === "string" ? options.auth : `${options.auth.username}:${options.auth.password}`;
  }

  // Set SSL options
  if (SSL_PROTOCOL_REGEX.test((target as URL).protocol || "")) {
    outgoing.rejectUnauthorized = options.secure !== undefined ? options.secure : true;
  }

  // Set agent and local address
  outgoing.agent = options.agent || false;
  outgoing.localAddress = options.localAddress;

  // Set connection header if agent is false
  if (!outgoing.agent) {
    outgoing.headers = outgoing.headers || {};
    if (
      typeof outgoing.headers.connection !== "string" ||
      !UPGRADE_HEADER_REGEX.test(outgoing.headers.connection as string)
    ) {
      outgoing.headers.connection = "close";
    }
  }

  // Build the path
  let targetPath = "";
  if (target && options.prependPath !== false) {
    targetPath = (target as ProxyTarget).path || "";
  }

  // Get the outgoing path
  let outgoingPath = "";
  if (!options.toProxy) {
    outgoingPath = new URL(req.url || "/", "http://localhost").pathname || "";
  } else {
    outgoingPath = req.url || "/";
  }

  // Apply ignorePath option
  outgoingPath = !options.ignorePath ? outgoingPath : "";

  // Apply pathRewrite if provided (NestJS specific)
  if (options.pathRewrite) {
    for (const pattern in options.pathRewrite) {
      outgoingPath = outgoingPath.replace(new RegExp(pattern), options.pathRewrite[pattern]);
    }
  }

  // Join paths
  outgoing.path = urlJoin(targetPath, outgoingPath);

  // Set host header for changeOrigin
  if (options.changeOrigin) {
    const hostHeader =
      outgoing.port !== 80 && outgoing.port !== 443
        ? `${outgoing.hostname || outgoing.host}:${outgoing.port}`
        : outgoing.hostname || outgoing.host;

    if (hostHeader) {
      outgoing.headers.host = hostHeader;
    }
  }

  return outgoing;
}

/**
 * Set up socket options
 */
export function setupSocket(socket: any): any {
  socket.setTimeout(0);
  socket.setNoDelay(true);
  socket.setKeepAlive(true, 0);
  return socket;
}

/**
 * Check if connection is encrypted
 */
export function hasEncryptedConnection(req: IncomingMessage): boolean {
  return Boolean((req.socket as any).encrypted || (req.socket as any).pair);
}

/**
 * Join URL paths
 */
export function urlJoin(...args: string[]): string {
  // Get the last argument
  const lastIndex = args.length - 1;
  const last = args[lastIndex];

  if (!last) return "";

  // Split by query string
  const lastSegs = last.split("?");
  args[lastIndex] = lastSegs.shift() || "";

  // Join all parts, filtering out empty strings
  const path = args
    .filter(Boolean)
    .join("/")
    .replace(/\/+/g, "/")
    .replace("http:/", "http://")
    .replace("https:/", "https://");

  // Add query string back if it exists
  return lastSegs.length > 0 ? `${path}?${lastSegs.join("?")}` : path;
}

/**
 * Rewrite cookie property (domain or path)
 */
export function rewriteCookieProperty(
  header: string | string[],
  config: Record<string, string | null>,
  property: string
): string | string[] {
  if (Array.isArray(header)) {
    return header.map((h) => rewriteCookieProperty(h, config, property) as string);
  }

  const pattern = new RegExp(`(;\\s*${property}=)([^;]+)`, "i");

  return header.replace(pattern, (match, prefix, previousValue) => {
    let newValue;

    if (previousValue in config) {
      newValue = config[previousValue];
    } else if ("*" in config) {
      newValue = config["*"];
    } else {
      return match; // No match, return unchanged
    }

    if (newValue) {
      return prefix + newValue; // Replace value
    } else {
      return ""; // Remove property
    }
  });
}

/**
 * Logger for proxy events
 */
export class ProxyLogger {
  private logger = new Logger("Proxy");

  constructor(private readonly options: ProxyOptions) {}

  log(level: string, message: string, ...args: any[]): void {
    if (!this.options.logLevel || this.options.logLevel === "silent") {
      return;
    }

    const levels = ["debug", "info", "warn", "error"];
    const levelIndex = levels.indexOf(level);
    const configLevelIndex = levels.indexOf(this.options.logLevel);

    if (levelIndex >= configLevelIndex) {
      const logger = this.options.logProvider ? this.options.logProvider(console) : console;

      logger[level](message, ...args);
    }
  }

  debug(message: string, ...args: any[]): void {
    this.logger.debug(message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.logger.log(message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.logger.warn(message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.logger.error(message, ...args);
  }
}
