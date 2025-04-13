import { CanActivate, DynamicModule, NestMiddleware, RequestMethod, Type } from "@nestjs/common";
import { IncomingMessage, ServerResponse } from "http";
import { Socket } from "net";
import { URL } from "url";

import { ServiceInstance } from "../common";
import { ProxyModuleBuilder } from "./proxy-module.builder";

export type HookExclude = {
  path: string;
  method: RequestMethod;
};

export type RequestHook<T> =
  | {
      instance: Type<T>;
      excludes?: Array<HookExclude>;
    }
  | Type<T>;

export type ProxyRequestHooks = Partial<{
  middlewares: Array<RequestHook<NestMiddleware>>;
  guards: Array<RequestHook<CanActivate>>;
}>;

/**
 * Configuration for defining a proxy route.
 *
 * @property route - The route pattern to match incoming requests.
 * @property target - The target service URL to which requests should be proxied.
 * @property middlewares - An optional array of middleware types to apply to the route.
 * @property guards - An optional array of guard types to enforce access control on the route.
 * @property pathRewrite - An optional mapping of path patterns to rewrite the request path.
 * @property timeout - An optional timeout value (in milliseconds) for the proxy request.
 * @property protocol - The protocol to use for the proxy, either "http" or "ws" (WebSocket).
 */
export type ProxyRouteConfig = {
  route: string;
  service?: string;
  pathRewrite?: { [key: string]: string };
  timeout?: number;
  protocol?: "http" | "ws";
  target?: ((instance: ServiceInstance) => string) | string;
  requestHooks?: ProxyRequestHooks;
};

export type IRoutingConfig = {
  configure(builder: ProxyModuleBuilder): DynamicModule | Promise<DynamicModule>;
};

/**
 * Represents the configuration options for a proxy target.
 *
 * @property host - The host of the proxy target (optional).
 * @property hostname - The hostname of the proxy target (optional).
 * @property port - The port number of the proxy target (optional).
 * @property path - The path for the proxy target (optional).
 * @property protocol - The protocol to use (e.g., 'http', 'https') (optional).
 * @property socketPath - The Unix socket path for the proxy target (optional).
 * @property pfx - The private key, certificate, or array of both in PFX format (optional).
 * @property key - The private key or array of private keys (optional).
 * @property cert - The certificate or array of certificates (optional).
 * @property ca - The certificate authority or array of certificate authorities (optional).
 * @property secureProtocol - The secure protocol to use (e.g., 'TLSv1_2_method') (optional).
 * @property passphrase - The passphrase for the private key or PFX (optional).
 * @property ciphers - The cipher suite to use (optional).
 */
export type ProxyTarget = {
  host?: string;
  hostname?: string;
  port?: number;
  path?: string;
  protocol?: string;
  socketPath?: string;
  pfx?: string | Buffer | Array<string | Buffer>;
  key?: string | Buffer | Array<string | Buffer>;
  cert?: string | Buffer | Array<string | Buffer>;
  ca?: string | Buffer | Array<string | Buffer>;
  secureProtocol?: string;
  passphrase?: string;
  ciphers?: string;
};

/**
 * Options for configuring a proxy.
 *
 * @typedef ProxyOptions
 * @property {string | URL | ProxyTarget} [target] - The target server to proxy requests to.
 * @property {boolean} [changeOrigin] - Whether to change the origin of the host header to the target URL.
 * @property {boolean} [xfwd] - Adds x-forward headers (e.g., `X-Forwarded-For`, `X-Forwarded-Host`, `X-Forwarded-Proto`).
 * @property {Record<string, string>} [pathRewrite] - A mapping of paths to rewrite, where keys are paths to match and values are the rewritten paths.
 * @property {boolean} [preserveHeaderKeyCase] - Whether to preserve the case of header keys.
 * @property {Buffer | string | Record<string, any>} [buffer] - A buffer, string, or object to use as the request body.
 * @property {number} [proxyTimeout] - Timeout (in milliseconds) for proxy requests.
 * @property {boolean} [secure] - Whether to verify the SSL certificate of the target.
 * @property {number} [timeout] - Proxy timeout in ms.
 * @property {string} [localAddress] - Local interface to bind for outgoing connections.
 * @property {boolean} [prependPath] - Whether to prepend the target path to the proxy path.
 * @property {boolean} [toProxy] - Whether to pass the absolute URL as the `path` (useful for proxying to proxies).
 * @property {boolean} [ignorePath] - Whether to ignore the path of the incoming request.
 * @property {string | Record<string, string | null>} [cookieDomainRewrite] - A mapping of cookie domains to rewrite, or a single domain to rewrite.
 * @property {string | Record<string, string | null>} [cookiePathRewrite] - A mapping of cookie paths to rewrite, or a single path to rewrite.
 * @property {Record<string, string | URL | ProxyTarget>} [router] - A mapping of hostnames to target servers for dynamic routing.
 */
export type ProxyOptions = {
  target?: string | URL | ProxyTarget;
  changeOrigin?: boolean;
  xfwd?: boolean;
  pathRewrite?: Record<string, string>;
  preserveHeaderKeyCase?: boolean;
  buffer?: Buffer | string | Record<string, any>;
  proxyTimeout?: number;
  secure?: boolean;
  timeout?: number;
  localAddress?: string;
  prependPath?: boolean;
  toProxy?: boolean;
  ignorePath?: boolean;
  cookieDomainRewrite?: string | Record<string, string | null>;
  cookiePathRewrite?: string | Record<string, string | null>;
  router?: Record<string, string | URL | ProxyTarget>;
};

/**
 * Represents the options for outgoing HTTP or HTTPS requests.
 *
 * @property {string} [host] - The host of the server to connect to.
 * @property {string} [hostname] - The hostname of the server to connect to.
 * @property {number} [port] - The port of the server to connect to.
 * @property {string} [path] - The request path, including query string if applicable.
 * @property {string} [method] - The HTTP method to use for the request (e.g., "GET", "POST").
 * @property {string} [protocol] - The protocol to use (e.g., "http:", "https:").
 *
 * @property {{ [key: string]: string | string[] }} [headers] - An object representing the request headers.
 *
 * @property {string} [socketPath] - The Unix domain socket path to use for the connection.
 * @property {string} [localAddress] - The local address to bind to for network connections.
 *
 * @property {string | Buffer | Array<string | Buffer>} [pfx] - The private key, certificate, and CA certs in PFX or PKCS12 format.
 * @property {string | Buffer | Array<string | Buffer>} [key] - The private key for SSL/TLS.
 * @property {string} [passphrase] - The passphrase for the private key or PFX.
 * @property {string | Buffer | Array<string | Buffer>} [cert] - The public x509 certificate.
 * @property {string | Buffer | Array<string | Buffer>} [ca] - The certificate authority bundle.
 * @property {string} [ciphers] - The cipher suite to use for SSL/TLS.
 * @property {string} [secureProtocol] - The SSL/TLS protocol to use (e.g., "TLSv1_2_method").
 * @property {boolean} [rejectUnauthorized] - Whether to reject unauthorized SSL/TLS certificates.
 */
export type OutgoingOptions = {
  host?: string;
  hostname?: string;
  socketPath?: string;
  port?: number;
  path?: string;
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  agent?: any;
  localAddress?: string;
  pfx?: string | Buffer | Array<string | Buffer>;
  key?: string | Buffer | Array<string | Buffer>;
  passphrase?: string;
  cert?: string | Buffer | Array<string | Buffer>;
  ca?: string | Buffer | Array<string | Buffer>;
  ciphers?: string;
  secureProtocol?: string;
  rejectUnauthorized?: boolean;
};

/**
 * Interface representing the callback functions for proxy events.
 */
export interface ProxyCallbacks {
  /**
   * Called when the proxy starts processing a request.
   *
   * @param req - The incoming HTTP request.
   * @param res - The outgoing HTTP response.
   * @param target - The target URL or proxy target being proxied to.
   */
  onStart?: (req: IncomingMessage, res: ServerResponse, target: string | URL | ProxyTarget | undefined) => void;

  /**
   * Called before the proxy request is sent.
   *
   * @param proxyReq - The outgoing proxy request.
   * @param req - The incoming HTTP request.
   * @param res - The outgoing HTTP response.
   * @param socket - The network socket.
   */
  onProxyReq?: (proxyReq: any, req: IncomingMessage, res: ServerResponse, socket: Socket) => void;

  /**
   * Called before the proxy WebSocket request is sent.
   *
   * @param proxyReq - The outgoing proxy WebSocket request.
   * @param req - The incoming HTTP request.
   * @param socket - The network socket.
   * @param options - The proxy options.
   * @param head - The first packet of the upgraded stream.
   */
  onProxyReqWs?: (proxyReq: any, req: IncomingMessage, socket: Socket, options: ProxyOptions, head: Buffer) => void;

  /**
   * Called when the proxy receives a response from the target.
   *
   * @param proxyRes - The incoming response from the target.
   * @param req - The incoming HTTP request.
   * @param res - The outgoing HTTP response.
   */
  onProxyRes?: (proxyRes: IncomingMessage, req: IncomingMessage, res: ServerResponse) => void;

  /**
   * Called when the proxy connection is opened.
   *
   * @param proxySocket - The proxy socket.
   */
  onOpen?: (proxySocket: Socket) => void;

  /**
   * Called when the proxy connection is closed.
   *
   * @param proxyRes - The incoming response from the target.
   * @param proxySocket - The proxy socket.
   * @param proxyHead - The remaining data in the socket buffer.
   */
  onClose?: (proxyRes: IncomingMessage, proxySocket: Socket, proxyHead: Buffer) => void;

  /**
   * Called when the proxy request ends.
   *
   * @param req - The incoming HTTP request.
   * @param res - The outgoing HTTP response.
   * @param proxyRes - The incoming response from the target.
   */
  onEnd?: (req: IncomingMessage, res: ServerResponse, proxyRes: IncomingMessage) => void;

  /**
   * Called when an error occurs during proxying.
   *
   * @param err - The error that occurred.
   * @param req - The incoming HTTP request.
   * @param res - The outgoing HTTP response or socket.
   * @param target - The target URL or proxy target being proxied to.
   */
  onError?: (
    err: Error,
    req: IncomingMessage,
    res: ServerResponse | Socket,
    target?: string | URL | ProxyTarget
  ) => void;
}
