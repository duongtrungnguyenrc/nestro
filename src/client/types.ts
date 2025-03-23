import { HttpProtocols } from "../global-types";

export type ClientServiceOptions = {
  nestro: {
    host: string;
    port?: number;
    protocol?: HttpProtocols;
  };
  client: {
    name: string;
    host: string;
    port: number;
    protocol?: HttpProtocols;
  };
  heartbeatInterval?: number;
};
