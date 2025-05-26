import { Controller, All, Req, Res, Inject, RawBodyRequest } from "@nestjs/common";
import { Request, Response } from "express";

import { GatewayService } from "../services";

/**
 * Controller for handling proxy requests.
 * Routes HTTP and WebSocket requests (including Socket.IO) to appropriate targets based on configuration.
 */
@Controller()
export class GatewayController {
  constructor(@Inject(GatewayService) private readonly gatewayService: GatewayService) {}

  @All("*")
  async handleRequest(@Req() req: RawBodyRequest<Request>, @Res() res: Response): Promise<void> {
    return this.gatewayService.proxyRequest(req, res);
  }
}
