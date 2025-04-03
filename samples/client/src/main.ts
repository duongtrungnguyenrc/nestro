import { createNestroApplication } from "@duongtrungnguyen/nestro";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await createNestroApplication(AppModule, {
    server: {
      host: "localhost", // Server host
      port: 4444, // Server port (Default: 4444)
      secure: process.env.NODE_ENV === "production", // Server secure
    },
    client: {
      name: "client", // Service name
      host: "localhost", // Service instance host
      port: 3001, // Service instance port
      secure: process.env.NODE_ENV === "production", // Service instance secure
      heartbeatInterval: 10000, // Heartbeat interval in milliseconds
    },
    security: {
      privateKeyPath: "./private.pem", // private server generated key path
      publicKeyPath: "./public.pem", // public server generated key path
    },
    loadbalancing: {
      strategy: "round-robin", // load balancing strategy: [random, round-robin, least-connections]
      refreshInterval: 10000, // refresh interval in milliseconds
    },
  });
  await app.listen();
}
bootstrap();
