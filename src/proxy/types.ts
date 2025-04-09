import { IncomingMessage, ServerResponse } from "http";
import { TLSSocketOptions } from "tls";
import { Socket } from "net";
import { URL } from "url";

export type ProxyRouteConfig = {
  route: string;
  target: string;
  middlewares?: any[];
  guards?: any[];
  retryLimit?: number;
  pathRewrite?: { [key: string]: string };
  timeout?: number;
};

/**
 * Target location configuration
 */
export type ProxyTarget = {
  host?: string;
  hostname?: string;
  port?: number;
  path?: string;
  protocol?: string;
  socketPath?: string;

  // SSL/TLS options
  pfx?: string | Buffer | Array<string | Buffer>;
  key?: string | Buffer | Array<string | Buffer>;
  passphrase?: string;
  cert?: string | Buffer | Array<string | Buffer>;
  ca?: string | Buffer | Array<string | Buffer>;
  ciphers?: string;
  secureProtocol?: string;
};

/**
 * HTTP authentication configuration
 */
export type ProxyAuth = {
  username: string;
  password: string;
};

/**
 * Proxy configuration options
 */
export type ProxyOptions = {
  // Target and routing
  target?: string | URL | ProxyTarget;
  forward?: string | URL | ProxyTarget;
  agent?: boolean | any;
  ssl?: TLSSocketOptions;
  ws?: boolean;
  xfwd?: boolean;
  toProxy?: boolean;
  prependPath?: boolean;
  ignorePath?: boolean;
  localAddress?: string;
  changeOrigin?: boolean;
  preserveHeaderKeyCase?: boolean;
  auth?: string | ProxyAuth;
  hostRewrite?: string;
  autoRewrite?: boolean;
  protocolRewrite?: string;
  timeout?: number;
  proxyTimeout?: number;
  cookieDomainRewrite?: { [key: string]: string } | string;
  cookiePathRewrite?: { [key: string]: string } | string;
  secure?: boolean;
  headers?: { [key: string]: string };
  buffer?: any;
  followRedirects?: boolean;
  pathRewrite?: { [key: string]: string };
  router?: { [key: string]: string | ProxyTarget };
  logLevel?: "debug" | "info" | "warn" | "error" | "silent";
  logProvider?: (provider: any) => any;
};

/**
 * Outgoing request options
 */
export type OutgoingOptions = {
  // Connection details
  host?: string;
  hostname?: string;
  port?: number;
  path?: string;
  method?: string;
  protocol?: string;

  // Headers
  headers?: { [key: string]: string | string[] };

  // Authentication
  auth?: string;

  // Socket options
  socketPath?: string;
  localAddress?: string;

  // SSL/TLS options
  pfx?: string | Buffer | Array<string | Buffer>;
  key?: string | Buffer | Array<string | Buffer>;
  passphrase?: string;
  cert?: string | Buffer | Array<string | Buffer>;
  ca?: string | Buffer | Array<string | Buffer>;
  ciphers?: string;
  secureProtocol?: string;
  rejectUnauthorized?: boolean;

  // Agent
  agent?: boolean | any;
};

export type ProxyCallbacks = {
  onStart?: (req: IncomingMessage, res: ServerResponse, target: any) => void;
  onProxyReq?: (proxyReq: any, req: IncomingMessage, res: ServerResponse, options: ProxyOptions) => void;
  onProxyRes?: (proxyRes: IncomingMessage, req: IncomingMessage, res: ServerResponse) => void;
  onEnd?: (req: IncomingMessage, res: ServerResponse, proxyRes: IncomingMessage) => void;
  onError?: (err: Error, req: IncomingMessage, res: ServerResponse | Socket, target?: any) => void;
  onProxyReqWs?: (proxyReq: any, req: IncomingMessage, socket: Socket, options: ProxyOptions, head: Buffer) => void;
  onOpen?: (proxySocket: Socket) => void;
  onClose?: (proxyRes: IncomingMessage, proxySocket: Socket, proxyHead: Buffer) => void;
};
