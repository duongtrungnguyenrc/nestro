import { networkInterfaces } from "os";
import * as net from "net";

import { DEFAULT_HOST } from "../common";

export async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.listen(0, () => {
      const address = server.address();

      if (typeof address === "object" && address !== null) {
        const port = address.port;

        server.close(() => resolve(port));
      } else {
        reject(new Error("Cannot get free port"));
      }
    });

    server.on("error", reject);
  });
}

export function getDefaultHost() {
  const networkinfo = networkInterfaces();

  return networkinfo["lo0"]?.[0]?.address || DEFAULT_HOST;
}
