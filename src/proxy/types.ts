export type ProxyRouteConfig = {
  route: string;
  target: string;
  middlewares?: any[];
  guards?: any[];
  retryLimit?: number;
  rewritePath?: (path: string) => string;
};
