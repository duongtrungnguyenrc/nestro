import { createNestroServer, NestroApplication } from "@duongtrungnguyen/nestro";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app: NestroApplication = await createNestroServer(AppModule, {
    security: {
      publicKeyPath: "~/keys/public.pem",
      privateKeyPath: "~/keys/private.pem",
    },
    enableRegistryDashboard: true,
  });

  await app.listen(4444);
}
bootstrap();
