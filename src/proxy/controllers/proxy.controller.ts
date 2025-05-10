import { Controller, All, Req, Res, Inject, RawBodyRequest } from "@nestjs/common";
import { Request, Response } from "express";

import { ProxyService } from "../services";

/**
 * Controller for handling proxy requests.
 * Routes HTTP and WebSocket requests (including Socket.IO) to appropriate targets based on configuration.
 */
@Controller()
export class ProxyController {
  constructor(@Inject(ProxyService) private readonly proxyService: ProxyService) {}

  @All("*")
  async handleRequest(@Req() req: RawBodyRequest<Request>, @Res() res: Response): Promise<void> {
    return this.proxyService.execute(req, res);
  }
}
