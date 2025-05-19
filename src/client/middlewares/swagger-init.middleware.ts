import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { serve } from "swagger-ui-express";

@Injectable()
export class SwaggerInitMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    return serve[0](req, res, next);
  }
}
