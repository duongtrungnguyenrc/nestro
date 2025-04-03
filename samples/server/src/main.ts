import { createNestroServer } from "@duongtrungnguyen/nestro";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await createNestroServer(AppModule, {
    publicKeyPath: "../../keys/public.pem", // Public generated secure key path
    privateKeyPath: "../../keys/private.pem", // Private generated secure key path
    enableRegistryDashboard: true, // Enable registry dashboard to monitor service instances
  });
  await app.listen(3000);
}
bootstrap();
