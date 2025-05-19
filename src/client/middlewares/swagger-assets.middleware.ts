import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { serve } from "swagger-ui-express";

@Injectable()
export class SwaggerAssetsMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    return serve[1](req, res, next);
  }
}
