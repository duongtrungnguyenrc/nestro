<div align="center">

# NESTRO

_Empower seamless microservices with effortless service discovery._

![last-commit](https://img.shields.io/github/last-commit/duongtrungnguyenrc/nestro?style=flat&logo=git&logoColor=white&color=0080ff) ![repo-top-language](https://img.shields.io/github/languages/top/duongtrungnguyenrc/nestro?style=flat&color=0080ff) ![repo-language-count](https://img.shields.io/github/languages/count/duongtrungnguyenrc/nestro?style=flat&color=0080ff)

_Built with the tools and technologies:_

![Express](https://img.shields.io/badge/Express-000000.svg?style=flat&logo=Express&logoColor=white) ![JSON](https://img.shields.io/badge/JSON-000000.svg?style=flat&logo=JSON&logoColor=white) ![npm](https://img.shields.io/badge/npm-CB3837.svg?style=flat&logo=npm&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=flat&logo=JavaScript&logoColor=black) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6.svg?style=flat&logo=TypeScript&logoColor=white) ![ESLint](https://img.shields.io/badge/ESLint-4B32C3.svg?style=flat&logo=ESLint&logoColor=white) ![CSS](https://img.shields.io/badge/CSS-663399.svg?style=flat&logo=CSS&logoColor=white)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Samples](#samples)

---

## Overview

Nestro is a powerful service registry designed for NestJS applications. It streamlines the management and discovery of microservices by offering an HTTP-based pooling mechanism, real-time service monitoring, and a comprehensive dashboard for managing service dependencies. Nestro provides essential tools for efficient service registration and load balancing, tailored specifically for the NestJS ecosystem.

**Features**

- **HTTP Pooling & Service Registration:**  
  Services register themselves via HTTP requests. Regular heartbeats are sent to ensure that the registry remains updated with active instances.
- **Dynamic Load Balancing:**  
  Distribute incoming requests using flexible strategies such as round-robin, random, or least-connections for optimal performance.
- **Robust Security:**  
  Integrates key management and request validation to secure service communications.
- **Modular Architecture:**  
  Built with NestJS, Nestro promotes reusability and clean organization, making it easy to extend functionalities.
- **User-Friendly Dashboard:**  
  Monitor service instances in real-time, manage service dependencies, and perform administrative actions (e.g., deregistering services) directly through the dashboard.

**How it works?**

**_HTTP Pooling & Service Registration_**

- **Service Registration:**  
  Each microservice registers with the Nestro server upon startup by sending an HTTP POST request. The registration includes critical information such as the service name, host, port, and security details.
- **Heartbeat Mechanism:**  
  To maintain an accurate registry, each service sends regular heartbeat requests. This mechanism allows the server to track active instances and remove those that no longer respond.
- **HTTP Pooling:**  
  When a client makes a request, Nestro pools the available service instances based on the configured load balancing strategy. This ensures that traffic is distributed evenly and efficiently among all registered services.

**_Dependency Dashboard_**

- **Real-Time Monitoring:**  
  The integrated dashboard displays the status of every registered service instance, including metrics like instance count, registration time, and expiration time.
- **Dependency Management:**  
  Easily visualize and manage service dependencies. The dashboard highlights relationships between services, allowing for quick identification of potential bottlenecks or scalability issues.
- **Administrative Actions:**  
  Administrators can perform actions such as deregistering services directly from the dashboard, streamlining maintenance and troubleshooting processes.

---

## Getting Started

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

### Samples

**Nestro server**

Nestro needs an intermediary service to handle the service registry to avoid bottlenecks.

```ts
/* nestro-server/main.ts */

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
```

**Nestro client applications**

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

For api gateway or communication between registered services. We using http proxy to handle proxy forwarding request to registered microservices.

```ts
/* nestro-gateway/gateway.module.ts */

import { ProxyModule } from "@duongtrungnguyen/nestro";
import { Module } from "@nestjs/common";

@Module({
  imports: [
    ProxyModule.builder()
      .route({
        route: "/user/*", // Route to match
        retryLimit: 1, // Retry limit for the request
        target: "user", // Target service name
        rewritePath: (path) => path.replace("/user", ""), // Rewrite path
      })
      .build(),
  ],
})
export class GatewayModule {}
```
