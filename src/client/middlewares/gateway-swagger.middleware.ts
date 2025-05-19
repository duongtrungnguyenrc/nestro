import { Inject, Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { setup } from "swagger-ui-express";

import { buildInstanceHttpUrl, Service } from "../../common";
import { DiscoveryService } from "../../discovery";
import { GATEWAY_OPTIONS } from "../constants";
import { GatewayOptions } from "../types";

@Injectable()
export class GatewaySwaggerMiddleware implements NestMiddleware {
  constructor(
    @Inject(DiscoveryService) private readonly discoveryService: DiscoveryService,
    @Inject(GATEWAY_OPTIONS) private readonly gatewayOptions: GatewayOptions
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const requestPath = this._normalizePath(req.originalUrl);
    const swaggerPath = this._normalizePath(this.gatewayOptions.swagger.path);
    const swaggerJsonPath = this._normalizePath(this.gatewayOptions.swagger.jsonPath);

    if (swaggerPath === swaggerJsonPath) {
      throw new Error("Swagger json document path must conflict with Swagger ui document path");
    }

    if (requestPath !== swaggerPath && requestPath !== swaggerJsonPath) return next();

    const services: Map<string, Service[]> = this.discoveryService.getServices();

    const docs: any[] = [];

    await Promise.all(
      Array.from(services.entries())
        .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }))
        .map(async ([, instances]) => {
          const doc = await this.fetchFirstValidDoc(
            instances.map((s: Service) => `${buildInstanceHttpUrl(s)}/${s.swaggerJsonPath || "api-docs-json"}`)
          );
          if (doc) docs.push(doc);
        })
    );

    const mergedDoc = this.mergeDocs(docs);

    if (requestPath === swaggerJsonPath) {
      return res.json(mergedDoc);
    }

    return setup(mergedDoc)(req, res, next);
  }

  private _normalizePath(path?: string): string | undefined {
    if (!path) return undefined;

    if (!path.startsWith("/")) path = "/" + path;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    return path;
  }

  private async fetchFirstValidDoc(urls: string[]): Promise<any | null> {
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const doc = await res.json();
          if (doc.openapi && doc.paths) return doc;
        }
      } catch (_) {
        continue;
      }
    }
    return null;
  }

  private mergeDocs(docs: any[]): Record<string, any> {
    return docs.reduce((acc, doc, idx) => {
      if (idx === 0) {
        acc.openapi = "3.0.0";
        acc.info = {
          title: this.gatewayOptions.swagger.title,
          description: this.gatewayOptions.swagger.description,
          version: this.gatewayOptions.swagger.version,
        };
        acc.paths = {};
        acc.components = { schemas: {} };
        acc.servers = [];
        acc.tags = [];
      }

      acc.paths = { ...acc.paths, ...doc.paths };

      acc.components.schemas = {
        ...acc.components.schemas,
        ...(doc.components?.schemas ?? {}),
      };

      if (Array.isArray(doc.servers)) {
        acc.servers.push(...doc.servers);
      }

      if (Array.isArray(doc.tags)) {
        acc.tags.push(...doc.tags);
      }

      return acc;
    }, {} as any);
  }
}
