import { IncomingMessage } from "http";
import { Socket } from "net";
import { URL } from "url";

import { SSL_PROTOCOL_REGEX, UPGRADE_HEADER_REGEX, WEBSOCKET_UPGRADE_REGEX, SOCKET_IO_PATH_REGEX } from "./constants";
import { OutgoingOptions, ProxyOptions, ProxyTarget } from "./types";

/**
 * Configures outgoing options for a proxy request.
 * Supports HTTP, WebSocket, and Socket.IO by preserving headers and query strings.
 *
 * @param outgoing - Initial outgoing options.
 * @param options - Proxy configuration options.
 * @param req - The incoming HTTP request.
 * @param forward - Optional key to select forward target (defaults to 'target').
 * @returns Configured outgoing options.
 */
export function setupOutgoing(
  outgoing: OutgoingOptions = {},
  options: ProxyOptions,
  req: IncomingMessage,
  forward?: string
): OutgoingOptions {
  const targetKey = forward || "target";
  const target = options[targetKey] as URL | ProxyTarget | undefined;

  if (!target) {
    return outgoing; // No target, return unchanged
  }

  // Set port
  outgoing.port = getTargetPort(target);

  // Copy target properties
  copyTargetProperties(outgoing, target);

  // Configure method and headers
  outgoing.method = req.method || "GET";
  outgoing.headers = req.headers;

  // Set SSL options
  if (SSL_PROTOCOL_REGEX.test((target as URL).protocol || "")) {
    outgoing.rejectUnauthorized = options.secure !== undefined ? options.secure : true;
  }

  outgoing.localAddress = options.localAddress;

  // Handle WebSocket/Socket.IO headers
  configureConnectionHeader(outgoing, req);

  // Build path with query string
  outgoing.path = buildPath(target, req.url || "/", options);

  // Set host header for changeOrigin
  if (options.changeOrigin) {
    const hostHeader = getHostHeader(outgoing);
    if (hostHeader) {
      outgoing.headers.host = hostHeader;
    }
  }

  return outgoing;
}

/**
 * Determines the port for the target server.
 *
 * @param target - The target URL or ProxyTarget.
 * @returns The port number.
 */
function getTargetPort(target: URL | ProxyTarget): number {
  if ((target as ProxyTarget).port) {
    return (target as ProxyTarget).port!;
  }
  if ((target as URL).port) {
    return parseInt((target as URL).port, 10);
  }
  return SSL_PROTOCOL_REGEX.test((target as URL).protocol || "") ? 443 : 80;
}

/**
 * Copies properties from the target to outgoing options.
 *
 * @param outgoing - Outgoing options to modify.
 * @param target - The target URL or ProxyTarget.
 */
function copyTargetProperties(outgoing: OutgoingOptions, target: URL | ProxyTarget): void {
  const props = [
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

  for (const prop of props) {
    if (target[prop] !== undefined) {
      (outgoing as any)[prop] = target[prop];
    }
  }
}

/**
 * Configures the Connection header for WebSocket or non-WebSocket requests.
 *
 * @param outgoing - Outgoing options to modify.
 * @param req - The incoming HTTP request.
 */
function configureConnectionHeader(outgoing: OutgoingOptions, req: IncomingMessage): void {
  const isWebSocket =
    req.headers.upgrade &&
    WEBSOCKET_UPGRADE_REGEX.test(req.headers.upgrade.toLowerCase()) &&
    req.headers.connection &&
    UPGRADE_HEADER_REGEX.test(req.headers.connection.toLowerCase());

  outgoing.headers = outgoing.headers || {};
  if (isWebSocket) {
    // Ensure Connection: upgrade for WebSocket/Socket.IO
    if (!outgoing.headers.connection) {
      outgoing.headers.connection = "upgrade";
    }
  } else if (!outgoing.agent && !outgoing.headers.connection) {
    // Set Connection: close for non-WebSocket requests without agent
    outgoing.headers.connection = "close";
  }
}

/**
 * Builds the outgoing path, preserving query strings for Socket.IO.
 *
 * @param target - The target URL or ProxyTarget.
 * @param reqUrl - The incoming request URL.
 * @param options - Proxy configuration options.
 * @returns The constructed path.
 */
function buildPath(target: URL | ProxyTarget, reqUrl: string, options: ProxyOptions): string {
  // Get target path
  let targetPath = "";
  if (options.prependPath !== false) {
    targetPath = (target as ProxyTarget).path || (target as URL).pathname || "";
  }

  // Parse request URL
  let outgoingPath = "";
  let queryString = "";
  if (!options.toProxy) {
    const parsedUrl = new URL(reqUrl, "http://localhost");
    outgoingPath = parsedUrl.pathname || "";
    queryString = parsedUrl.search || ""; // Preserve Socket.IO query (e.g., ?EIO=4)
  } else {
    outgoingPath = reqUrl || "/";
  }

  // Apply ignorePath
  if (options.ignorePath) {
    outgoingPath = "";
  }

  // Apply pathRewrite
  if (options.pathRewrite) {
    for (const pattern in options.pathRewrite) {
      outgoingPath = outgoingPath.replace(new RegExp(pattern), options.pathRewrite[pattern]);
    }
  }

  // Join paths and preserve query string
  return joinPaths(targetPath, outgoingPath) + queryString;
}

/**
 * Constructs the host header for changeOrigin.
 *
 * @param outgoing - Outgoing options.
 * @returns The host header string or undefined.
 */
function getHostHeader(outgoing: OutgoingOptions): string | undefined {
  if (outgoing.port !== 80 && outgoing.port !== 443) {
    return `${outgoing.hostname || outgoing.host}:${outgoing.port}`;
  }
  return outgoing.hostname || outgoing.host;
}

/**
 * Joins multiple URL paths, normalizing slashes.
 *
 * @param paths - Paths to join.
 * @returns The joined path.
 */
function joinPaths(...paths: string[]): string {
  if (!paths.length) return "";

  const filteredPaths = paths.filter(Boolean);
  if (!filteredPaths.length) return "";

  return filteredPaths
    .join("/")
    .replace(/\/+/g, "/")
    .replace(/http:\/|https:\//g, (match) => match.replace(":/", "://"));
}

/**
 * Configures socket options for optimal performance.
 * Used for WebSocket and Socket.IO connections.
 *
 * @param socket - The socket to configure.
 * @returns The configured socket.
 */
export function setupSocket(socket: Socket): Socket {
  socket.setTimeout(0); // Disable timeout
  socket.setNoDelay(true); // Disable Nagle's algorithm
  socket.setKeepAlive(true, 0); // Enable keep-alive
  return socket;
}

/**
 * Checks if the connection is encrypted (HTTPS/WSS).
 *
 * @param req - The incoming HTTP request.
 * @returns True if the connection is encrypted, false otherwise.
 */
export function hasEncryptedConnection(req: IncomingMessage): boolean {
  const socket = req.socket as any;
  return Boolean(socket.encrypted || socket.pair);
}

/**
 * Joins URL paths while preserving query strings.
 *
 * @param args - Paths to join.
 * @returns The joined URL path.
 */
export function urlJoin(...args: string[]): string {
  if (!args.length) return "";

  // Extract query string from the last argument
  const last = args[args.length - 1];
  const [path, ...queryParts] = last.split("?");
  const paths = [...args.slice(0, -1), path].filter(Boolean);

  // Join paths
  const joinedPath = joinPaths(...paths);

  // Append query string if present
  return queryParts.length > 0 ? `${joinedPath}?${queryParts.join("?")}` : joinedPath;
}

/**
 * Rewrites cookie properties (domain or path) in headers.
 *
 * @param header - The cookie header(s).
 * @param config - Configuration mapping for rewriting.
 * @param property - The property to rewrite (e.g., 'domain', 'path').
 * @returns The rewritten cookie header(s).
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
    const newValue = previousValue in config ? config[previousValue] : config["*"];
    return newValue ? `${prefix}${newValue}` : "";
  });
}

/**
 * Checks if the request is for Socket.IO.
 *
 * @param req - The incoming HTTP request.
 * @returns True if the request targets Socket.IO, false otherwise.
 */
export function isSocketIORequest(req: IncomingMessage): boolean {
  return !!req.url && SOCKET_IO_PATH_REGEX.test(req.url);
}
