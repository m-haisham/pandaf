# Architecture & Technical Specification: PDF Generation Microservice

## 1. Executive Summary

This document outlines the architecture, design decisions, and developer workflow for the enterprise PDF Generation Microservice.

The service transforms JSON data into pixel-perfect PDFs using modern web technologies (Vue.js, Tailwind CSS). It uses a multi-container architecture to ensure high performance, exact layout measurements, and stability under load by separating the rendering engine, the layout measurement engine, and the application orchestration.

Critically, the service supports **two distinct runtime modes**:

- **Production mode** — the Orchestrator loads pre-compiled, pre-bundled Vue SSR output from `dist/`. No Vite is present in the production container.
- **Development mode** — the Orchestrator runs Vite in **middleware mode**, compiling and SSR-rendering templates on every request straight from `src/`. There is no `vite build` step in the loop. Editing a `.vue` template and hitting the endpoint again reflects the change immediately (transform + module graph invalidation, no bundling).

This means template authors never run a build command while iterating. `pnpm dev` is the only command needed for the entire inner loop.

## 2. System Architecture

The microservice ecosystem consists of four runtime components, plus one dev-only component:

| Component                        | Tech                                      | Role                                                                                                                                                                             |
| -------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Orchestrator**                 | Node.js / Elysia (`@elysiajs/node`), pnpm | Entry point. Validates JSON via TypeBox, renders Vue → HTML string, coordinates the browser containers.                                                                          |
| **Renderer**                     | Gotenberg                                 | Stateless headless-Chromium container. Converts final HTML/CSS strings into a PDF binary stream.                                                                                 |
| **Measurement Engine**           | Browserless                               | Secondary headless Chrome container used exclusively for pre-flight DOM measurements (e.g. dynamic header/footer height, table pagination breakpoints).                          |
| **Cache**                        | Redis                                     | Caches layout measurements keyed by HTML hash, so identical templates/data don't re-measure.                                                                                     |
| **Vite Dev Server** _(dev only)_ | Vite, `@vue/server-renderer`              | Runs **inside the Orchestrator process** in middleware mode. Provides on-demand SSR compilation and a browser-based live-preview HMR server. Never present in production images. |

```
                        ┌─────────────────────────────┐
   PROD                 │  Orchestrator (Node/Elysia)  │
   ─────►  POST JSON ──►│  loads dist/entry-server.js  │──► Gotenberg ──► PDF
                        └─────────────────────────────┘
                                     │
                                     ▼
                                  Redis (measurement cache)

                        ┌───────────────────────────────────────┐
   DEV                  │  Orchestrator (Node/Elysia)            │
   ─────►  POST JSON ──►│  + Vite in middleware mode              │──► Gotenberg (optional) ──► PDF
          GET /preview ─┤  vite.ssrLoadModule('/src/...') on      │
                        │  every request — no build step          │
                        │  + HMR dev server for browser preview   │
                        └───────────────────────────────────────┘
```

## 3. Architectural Decisions & Justifications

### 3.1 Vue SSR + Tailwind over PDFKit/Native Libraries

**Decision:** Use Vue.js and Tailwind CSS compiled to static HTML via `@vue/server-renderer`.

**Justification:** Web technologies provide a superior Developer Experience (DX), allowing frontend engineers to author templates using standard flexbox, grids, and reactive data binding without calculating X/Y coordinates.

### 3.2 Elysia + Node.js (via pnpm)

**Decision:** Use the Elysia web framework running on Node.js using the `@elysiajs/node` adapter, managed by the pnpm package manager.

**Justification:** pnpm ensures strict dependency trees and fast CI/CD builds. Elysia provides built-in schema validation (TypeBox), ensuring the PDF service never attempts to render a document with malformed data. By using Node 20+, we leverage native `fetch` and `FormData` APIs without bulky external polyfills.

### 3.3 "Embed Everything" via Vite

**Decision:** Configure Vite to inline all assets (images, fonts, CSS) as Base64 data URIs within a single HTML string.

**Justification:** Eliminates network latency during PDF generation. The HTML package is 100% deterministic and self-contained.

### 3.4 Vite Middleware Mode for Development (new)

**Decision:** In development, do not run `vite build` at all. Instead, boot Vite programmatically via `vite.createServer({ server: { middlewareMode: true } })` inside the same process as the Elysia dev server, and use `vite.ssrLoadModule()` to import template entry points on demand.

**Justification:**

- **No build step in the loop.** `vite.ssrLoadModule` compiles + SSR-transforms only the modules touched by a given request, on the fly, with an in-memory module graph. There is nothing to "run" between edits.
- **True hot invalidation.** Vite's module graph tracks which `.vue` files changed since the last request; only those (and their importers) are re-transformed. A full `vite build` recompiles and re-bundles everything, which is wasted work for a single-invoice edit.
- **One process, two jobs.** The same Elysia server that serves `/api/v1/generate-pdf` also serves a `/__preview` route backed by Vite's HTML dev server, giving template authors instant browser HMR (edit `.vue` → see it re-render in the tab, no PDF round-trip needed for 90% of layout work).
- **Prod stays clean.** `vite` is a `devDependency` only. The production Docker image never installs it; production always loads the pre-built `dist/entry-server.js`, keeping the prod container small and the SSR path fully static/deterministic (per §3.3).

## 4. Developer Workflow & Monorepo Structure

The project is a single repository with two build targets — Vite (frontend compiler) and Node (backend runtime) — and two run modes: `pnpm dev` (no build) and `pnpm build && pnpm start` (production).

### 4.1 Directory Layout

```
.
├── src/
│   ├── templates/           # Vue SFCs — the actual PDF templates
│   │   └── Invoice.vue
│   ├── assets/
│   ├── shared-types/        # Types shared between Vue props and Elysia's TypeBox schema
│   ├── entry-server.ts      # SSR render entry — used by both dev (ssrLoadModule) and prod (bundled)
│   ├── dev/
│   │   ├── preview.html     # Vite HTML entry for the live-preview harness
│   │   └── preview-main.ts  # Mounts a template client-side with sample fixture data
│   └── server/
│       ├── index.ts         # Elysia app + route definitions (mode-agnostic)
│       ├── render.dev.ts    # Dev renderer: vite.ssrLoadModule per request
│       └── render.prod.ts   # Prod renderer: static import from dist/
├── vite.config.ts
├── Dockerfile
├── docker-compose.yml
├── docker-compose.dev.yml
└── package.json
```

### 4.2 Authoring the Vue Component

Create a standard Vue SFC inside `src/templates`.

```vue
<!-- src/templates/Invoice.vue -->
<template>
  <div class="p-10 font-sans bg-white text-gray-900">
    <img src="../assets/logo.png" class="w-32 mb-8" />
    <h1 class="text-4xl font-bold">Invoice #{{ id }}</h1>
    <p>Billed to: {{ customerName }}</p>
  </div>
</template>

<script setup lang="ts">
// Types can be shared with the Elysia validator!
import type { InvoiceData } from "../shared-types";
defineProps<InvoiceData>();
</script>
```

### 4.3 `pnpm dev` — Zero-Build Inner Loop

Running `pnpm dev` starts a single process that exposes **both** the API and a browser preview, wired to Vite in middleware mode. There is no separate "watch/build" step to babysit.

```json
// package.json (relevant scripts)
{
  "scripts": {
    "dev": "tsx watch src/dev-server.ts",
    "build": "vite build --ssr src/entry-server.ts --outDir dist && vite build --outDir dist/client",
    "start": "node dist-server/index.js"
  }
}
```

```ts
// src/dev-server.ts
import { createServer as createViteServer } from "vite";
import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { buildApp } from "./server/index";
import { renderDev } from "./server/render.dev";

async function main() {
  // Vite in middleware mode: no dev server of its own on a separate port,
  // no bundling — just on-demand transform + an HMR websocket.
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "custom",
  });

  const app = buildApp({
    // Inject the dev-mode renderer, which calls vite.ssrLoadModule()
    // fresh on every request instead of importing from dist/.
    render: (template: string, data: unknown) =>
      renderDev(vite, template, data),
  });

  // Mount Vite's connect middleware for the live-preview harness
  // (serves /dev/preview.html with full HMR for visual iteration).
  app.use(vite.middlewares);

  app.listen(8080, () => {
    console.log(
      "🦊 Dev orchestrator on :8080 — templates hot-reload, no build step",
    );
  });
}

main();
```

```ts
// src/server/render.dev.ts
import type { ViteDevServer } from "vite";

export async function renderDev(
  vite: ViteDevServer,
  template: string,
  data: unknown,
) {
  // ssrLoadModule compiles + SSR-transforms ONLY this module and its
  // uncached dependencies, using Vite's module graph. No dist/, no bundle.
  const mod = await vite.ssrLoadModule(`/src/templates/${template}.vue`);
  return mod.render(data); // see §4.4 for the render() export convention
}
```

```ts
// src/server/render.prod.ts
// Statically imported at build time — bundled into dist-server/index.js.
import { renderPdfBody } from "../../dist/entry-server.js";

export async function renderProd(template: string, data: unknown) {
  return renderPdfBody(template, data);
}
```

`buildApp()` picks whichever renderer it's handed, so `src/server/index.ts` itself is identical between dev and prod — only the entrypoint (`dev-server.ts` vs the compiled `dist-server/index.js`) differs in which renderer it wires up. This keeps route logic, validation, and Gotenberg orchestration from ever drifting between the two modes.

### 4.4 Browser Preview Without Generating a PDF

For layout/CSS iteration, going through Gotenberg on every keystroke is unnecessary — a normal browser is a perfectly good renderer for Tailwind/flexbox layout. The dev server exposes a plain HTML entry that Vite serves with full client-side HMR:

```html
<!-- src/dev/preview.html -->
<!DOCTYPE html>
<html>
  <head>
    <title>Template Preview</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/dev/preview-main.ts"></script>
  </body>
</html>
```

```ts
// src/dev/preview-main.ts
import { createApp } from "vue";
import Invoice from "../templates/Invoice.vue";
import fixture from "./fixtures/invoice.sample.json";

createApp(Invoice, fixture).mount("#app");
```

Visiting `http://localhost:8080/dev/preview.html` opens the template in-browser with sample data and standard Vite HMR — edits to `Invoice.vue` update the page instantly, same as any normal Vite app. This is the fast loop; hitting `/api/v1/generate-pdf` is reserved for verifying the actual PDF-specific concerns (pagination, print CSS, header/footer measurement via Browserless).

### 4.5 The Production Build

Production still builds once, ahead of time, and never touches Vite at runtime.

```bash
pnpm run build
# vite build --ssr src/entry-server.ts --outDir dist        (SSR bundle for renderer.prod.ts)
# vite build --outDir dist/client                            (static assets, Base64-inlined per §3.3)
```

## 5. Internal Orchestration Flow (Node.js + Elysia)

`src/server/index.ts` is mode-agnostic — it receives a `render` function via dependency injection and doesn't know or care whether it's backed by Vite middleware mode or a static `dist/` import.

```ts
// src/server/index.ts
import { Elysia, t } from "elysia";
import { node } from "@elysiajs/node";
import fs from "fs";
import path from "path";

type RenderFn = (template: string, data: unknown) => Promise<string>;

const compiledCss = fs.readFileSync(
  path.resolve("./dist/assets/style.css"),
  "utf-8",
);

const wrapHtml = (content: string) => `
  <!DOCTYPE html>
  <html>
    <head><style>${compiledCss}</style></head>
    <body>${content}</body>
  </html>
`;

export function buildApp({ render }: { render: RenderFn }) {
  return new Elysia().use(node()).post(
    "/api/v1/generate-pdf",
    async ({ body, query, set }) => {
      try {
        const rawVueHtml = await render(body.template, body.data);
        const bodyHtml = wrapHtml(rawVueHtml);
        const headerHtml = wrapHtml(`<div id="dynamic-header">...</div>`);

        // Dev convenience: ?preview=html returns the composed HTML directly
        // instead of round-tripping through Gotenberg, for quick sanity checks
        // of the actual SSR output (as opposed to the client-mounted preview).
        if (query.preview === "html") {
          set.headers = { "Content-Type": "text/html" };
          return bodyHtml;
        }

        const form = new FormData();
        form.append(
          "files",
          new Blob([bodyHtml], { type: "text/html" }),
          "index.html",
        );
        form.append(
          "files",
          new Blob([headerHtml], { type: "text/html" }),
          "header.html",
        );
        form.append("marginTop", "1");
        form.append("marginBottom", "1");

        const gotenbergRes = await fetch(
          process.env.GOTENBERG_URL + "/forms/chromium/convert/html",
          {
            method: "POST",
            body: form,
          },
        );

        if (!gotenbergRes.ok)
          throw new Error("Gotenberg failed to generate PDF");

        set.headers = {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${body.template}.pdf"`,
        };

        return gotenbergRes.body;
      } catch (error) {
        console.error(error);
        set.status = 500;
        return { error: "PDF Generation Failed" };
      }
    },
    {
      body: t.Object({
        template: t.String(),
        data: t.Any(),
      }),
      query: t.Object({
        preview: t.Optional(t.String()),
      }),
    },
  );
}
```

Production's entrypoint (`dist-server/index.js`, compiled from `src/server-prod.ts`) is a thin wrapper:

```ts
// src/server-prod.ts
import { buildApp } from "./server/index";
import { renderProd } from "./server/render.prod";

buildApp({ render: renderProd }).listen(8080, () => {
  console.log("🦊 Origami PDF Service running (prod, static dist/) on :8080");
});
```

## 6. Infrastructure (Docker Compose)

Production and development use **separate compose files**; dev never builds or ships Vite in an image at all — it bind-mounts source and runs `pnpm dev` directly.

```yaml
# docker-compose.yml (production)
services:
  pdf-orchestrator:
    build:
      context: .
      dockerfile: Dockerfile # node:20-alpine, pnpm install --prod, COPY dist/
    ports:
      - "8080:8080"
    environment:
      - REDIS_URL=redis://redis:6379
      - GOTENBERG_URL=http://gotenberg:3000
    depends_on: [gotenberg, browserless, redis]

  gotenberg:
    image: gotenberg/gotenberg:8
    ports: ["3000:3000"]

  browserless:
    image: browserless/chrome:latest
    ports: ["3001:3000"]

  redis:
    image: redis:alpine
    ports: ["6379:6379"]
```

```yaml
# docker-compose.dev.yml
services:
  pdf-orchestrator:
    build:
      context: .
      dockerfile: Dockerfile.dev # installs devDependencies too (vite, tsx)
    command: pnpm dev
    volumes:
      - ./src:/app/src # live source, no rebuild/redeploy on edit
      - /app/node_modules # keep container's node_modules, don't shadow with host
    ports:
      - "8080:8080"
    environment:
      - REDIS_URL=redis://redis:6379
      - GOTENBERG_URL=http://gotenberg:3000
    depends_on: [gotenberg, browserless, redis]

  gotenberg:
    image: gotenberg/gotenberg:8
    ports: ["3000:3000"]

  browserless:
    image: browserless/chrome:latest
    ports: ["3001:3000"]

  redis:
    image: redis:alpine
    ports: ["6379:6379"]
```

```bash
# local dev, full stack including Gotenberg for the rare "check the real PDF" pass
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# local dev, orchestrator only (fastest — most template work never needs Gotenberg)
pnpm dev
```

## 7. End-to-End (E2E) Testing Strategy

Testing runs against the **production** renderer path (`render.prod.ts` + a real `dist/` build) to catch anything that only manifests after bundling — e.g. asset inlining, CSS purge differences between Vite's dev transform and its production build. Vitest + `supertest` drive the Elysia endpoints; the resulting PDF buffer is parsed with `pdf-parse` to assert on text content and page count.

A lighter Vitest suite runs `render.dev.ts` directly (via `vite.ssrLoadModule`, no HTTP layer) so template authors get fast unit-level feedback on SSR output without needing Gotenberg at all.
