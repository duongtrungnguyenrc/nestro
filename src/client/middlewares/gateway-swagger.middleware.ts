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
    const isPathMatch = this.gatewayOptions.swagger.path === req.path;
    const isJsonPathMatch = this.gatewayOptions.swagger.jsonPath === req.path;

    if (!isPathMatch && !isJsonPathMatch) return next();

    const services: Map<string, Service[]> = this.discoveryService.getServices();

    const docs: any[] = [];

    await Promise.all(
      Array.from(services.values()).map(async (instances) => {
        const doc = await this.fetchFirstValidDoc(
          instances.map((s: Service) => `${buildInstanceHttpUrl(s)}/${s.swaggerJsonPath || "api-docs-json"}`)
        );
        if (doc) docs.push(doc);
      })
    );

    const mergedDoc = this.mergeDocs(docs);

    if (req.path === this.gatewayOptions.swagger.jsonPath) {
      res.json(mergedDoc);
    }

    return setup(mergedDoc)(req, res, next);
  }

  async fetchFirstValidDoc(urls: string[]): Promise<any | null> {
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

  mergeDocs(docs: any[]): Record<string, any> {
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
