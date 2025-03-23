import { Inject, Injectable, NestMiddleware, ForbiddenException } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

import { KeyService } from "../services";

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  constructor(@Inject(KeyService) private readonly keyService: KeyService) {}

  use(req: Request, _: Response, next: NextFunction) {
    const signature = req.headers["signature"] as string;

    if (!signature) {
      throw new ForbiddenException("Missing authentication signature");
    }

    const publicKey = this.keyService.getPublicKey();

    if (!this.keyService.verifyData(req.body ?? {}, signature, publicKey)) {
      throw new ForbiddenException("Invalid signature");
    }

    next();
  }
}
