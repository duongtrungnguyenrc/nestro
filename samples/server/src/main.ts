import { createNestroServer } from "@duongtrungnguyen/nestro";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await createNestroServer(AppModule, {
    security: {
      publicKeyPath: "~/keys/public.pem",
      privateKeyPath: "~/keys/private.pem",
    },
    enableRegistryDashboard: true,
  });
  await app.listen(4444);
}
bootstrap();
