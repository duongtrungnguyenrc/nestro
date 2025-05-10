<div align="center">

<img src="https://github.com/user-attachments/assets/09579645-adb7-4be6-a503-f7c297ed62e5" style="width:180px;height:180px;object-fit:cover;"></img>

_Empower seamless microservices with effortless service discovery._

![last-commit](https://img.shields.io/github/last-commit/duongtrungnguyenrc/nestro?style=flat&logo=git&logoColor=white&color=0080ff) ![repo-top-language](https://img.shields.io/github/languages/top/duongtrungnguyenrc/nestro?style=flat&color=0080ff) ![repo-language-count](https://img.shields.io/github/languages/count/duongtrungnguyenrc/nestro?style=flat&color=0080ff)

_Built with the tools and technologies:_

![Express](https://img.shields.io/badge/Express-000000.svg?style=flat&logo=Express&logoColor=white) ![JSON](https://img.shields.io/badge/JSON-000000.svg?style=flat&logo=JSON&logoColor=white) ![npm](https://img.shields.io/badge/npm-CB3837.svg?style=flat&logo=npm&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=flat&logo=JavaScript&logoColor=black) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6.svg?style=flat&logo=TypeScript&logoColor=white) ![ESLint](https://img.shields.io/badge/ESLint-4B32C3.svg?style=flat&logo=ESLint&logoColor=white) ![CSS](https://img.shields.io/badge/CSS-663399.svg?style=flat&logo=CSS&logoColor=white)

</div>

## I. Overview

Nestro is a powerful service registry designed for NestJS applications. It streamlines the management and discovery of microservices by offering an HTTP-based pooling mechanism, real-time service monitoring, and a comprehensive dashboard for managing service dependencies. Nestro provides essential tools for efficient service registration and load balancing, tailored specifically for the NestJS ecosystem.

**1. Features**

- **Service registration:**  
  Services register themselves via HTTP requests. Regular heartbeats are sent to ensure that the registry remains updated with active instances.
- **Dynamic load balancing and service discovery:**  
  Distribute incoming requests using flexible strategies such as round-robin, random, or least-connections for optimal performance.
- **Robust security:**  
  Integrates key management and request validation to secure service communications.
- **Modular Architecture:**  
  Built with NestJS, Nestro promotes reusability and clean organization, making it easy to extend functionalities.
- **User-Friendly Dashboard:**  
  Monitor service instances in real-time, manage service dependencies, and perform administrative actions (e.g., deregistering services) directly through the dashboard.

**2. How it works?**

**Service registration:**

- **Bootstrap:**  
  Each microservice registers with the Nestro server upon startup by sending an HTTP POST request. The registration includes critical information such as the service name, host, port, and security details.
- **Storage:**  
  Nestro stores this information in its internal registry, making the service discoverable for other clients or services.
- **Heartbeat:**  
  To maintain an accurate registry, each service sends regular heartbeat requests. This mechanism allows the server to track active instances and remove those that no longer respond.

**Service discovery:**

- When a client makes a request, Nestro will discover the available service instances based on the configured load balancing strategy. This ensures that traffic is distributed evenly and efficiently among all registered services.

---

## II. Getting Started

### Prerequisites

This project requires the following dependencies:

- **Programming Language:** TypeScript
- **Framework:** Nestjs
- **Platform:** Express

### Installation

Build nestro from the source and intsall dependencies:

**Clone the repository:**

    ❯ git clone https://github.com/duongtrungnguyenrc/nestro

**Using [npm](https://www.npmjs.com/):**

    ❯ npm install @duongtrungnguyenrc/nestro@latest

**Using [yarn](https://classic.yarnpkg.com/):**

    ❯ yarn add @duongtrungnguyenrc/nestro@latest

**Using [pnpm](https://pnpm.io/):**

    ❯ pnpm install @duongtrungnguyenrc/nestro@latest

### III. Samples

**1. Nestro server**

Nestro needs an intermediary service to handle the service registry to avoid bottlenecks.

```ts
/* nestro-server/main.ts */

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
```

**2. Nestro client applications**

Nestro client is that the microservices will register with the nestro server and use pooling to periodically send heartbeats to notify the nestro server that the client instance is still active.

```ts
/* nestro-microservice/main.ts */

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
```

**3. Gateway and communcations**

For api gateway or communication between registered services. We using http proxy to handle proxy forwarding request to registered microservices.

**NOTE:** Nest js always using body parser by default and body request alway read complete before streaming. But http proxy need raw body for streaming and we need to open raw body mode on Nest application options.

```ts
import { createNestroApplication } from "@duongtrungnguyen/nestro";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await createNestroApplication(
    AppModule,
    {
      // ... Nestro application configs
    },
    {
      rawBody: true, // Enable raw body
    }
  );

  await app.listen();
}
bootstrap();
```

Now we can config route proxy using builder pattern. Nestro will automatically handle proxy request.

```ts
/* nestro-gateway/gateway.module.ts */

import { ProxyModule } from "@duongtrungnguyen/nestro";
import { Module } from "@nestjs/common";

@Module({
  imports: [
    ProxyModule.builder()
      .httpRoute({
        // proxy http request
        route: "/user/*", // Route to match
        service: "user", // Target registered service
        target: "", // Force target path
        pathRewrite: { "^/api/user": "/" }, // Rewrite path
        timeout: 10000, // Proxy timeout
        requestHooks: {
          guards: [], // guards,
          middlewares: [], // middlewares
        },
      })
      .wsRoute({
        // proxy ws request
        // ... same options with http route
      })
      .useGlobalMiddleware(/*... middlewares */)
      .useGlobalGuard(/*... guards */)
      .build(),
  ],
})
export class GatewayModule {}
```

Or using config class

```ts
import { IRouteConfig, ProxyModuleBuilder } from "@duongtrungnguyen/nestro";
import { DynamicModule, RequestMethod } from "@nestjs/common";

export class GatewayConfig implements IRouteConfig {
  configure(builder: ProxyModuleBuilder): DynamicModule {
    return (
      builder
        .httpRoute({
          // ... options
        })
        .wsRoute({
          // ... options
        })
        // ... builder config
        .build()
    );
  }
}
```

```ts
import { ProxyModule } from "@duongtrungnguyen/nestro";
import { Module } from "@nestjs/common";

import { GatewayConfig } from "@gateway.config";

@Module({
  imports: [ProxyModule.config(GatewayConfig)],
})
export class AppModule {}
```

Or using `Proxy` decorator

```ts
import { Proxy, ProxyTemplate, ProxyService } from "@duongtrungnguyen/nestro";
import { Controller, Get, Param } from "@nestjs/common";

@Controller("api")
export class ApiController extends ProxyTemplate {
  constructor(proxyService: ProxyService /* Inject from proxy module */) {}

  @Get("users")
  @Proxy({
    target: "https://api.example.com",
    pathRewrite: { "^/api": "" },
  })
  proxyUsers() {
    // Don't need code here, Nestro will auto handle proxy
  }

  @Get("products/:id")
  @Proxy({
    target: "https://products.example.com",
    pathRewrite: { "^/api/products": "/products-api" },
  })
  proxyProduct(@Param("id") id: string) {
    // Don't need code here, Nestro will auto handle proxy
  }
}
```

For communication between multiple services. We using communication template to get best instance for communicate

```ts
import { CommunicateRequest, createCommunicationTemplate, DiscoveryService } from "@duongtrungnguyen/nestro";
import { Injectable } from "@nestjs/common";

@Injectable()
export class UserService extends createCommunicationTemplate("user") {
  constructor(discoveryService: DiscoveryService /* Load balancing service is global dependency*/) {
    // It is used to get the instance of the service
    super(discoveryService);
  }

  @CommunicateRequest()
  async getUser(instance: Service) {
    // do something with instance
  }
}
```
