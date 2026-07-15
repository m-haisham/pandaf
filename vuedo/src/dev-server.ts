import { createServer as createViteServer } from "vite";
import { Elysia } from "elysia";
import { createServer as createHttpServer } from "node:http";
import fs from "fs";
import path from "path";
import { renderDev } from "./server/render.dev";
import { buildApp } from "./server/index";

// Dev entrypoint: boots Vite in middleware mode inside the same process and
// wires up the dev renderer + HMR preview. No build step, per §3.4 / §4.3.
async function main() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "custom",
  });

  const app = buildApp({
    render: (template: string, data: unknown) =>
      renderDev(vite, template, data),
  });

  const httpServer = createHttpServer(async (req, res) => {
    // Vite owns everything except the API: serves /dev/preview.html with full
    // HMR and transforms /src modules on the fly.
    if (!req.url?.startsWith("/api/")) {
      const url = req.url ?? "/";
      if (url === "/dev/preview.html") {
        const raw = fs.readFileSync(
          path.resolve("src/dev/preview.html"),
          "utf-8",
        );
        const html = await vite.transformIndexHtml(url, raw);
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html");
        res.end(html);
        return;
      }
      vite.middlewares(req, res, () => {
        res.statusCode = 404;
        res.end("Not found");
      });
      return;
    }

    const url = `http://localhost${req.url}`;
    const method = req.method ?? "GET";
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body =
      method !== "GET" && method !== "HEAD"
        ? Buffer.concat(chunks)
        : undefined;

    const request = new Request(url, {
      method,
      headers: req.headers as Record<string, string>,
      body,
    });

    const response = await app.handle(request);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const buffer = Buffer.from(await response.arrayBuffer());
    res.end(buffer);
  });

  httpServer.listen(8080, () => {
    console.log(
      "🦊 Dev orchestrator on :8080 — templates hot-reload, no build step",
    );
  });
}

main();
