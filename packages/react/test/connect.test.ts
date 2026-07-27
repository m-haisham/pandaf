import { describe, it, expect, beforeAll } from "vitest";
import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import type { IncomingMessage, ServerResponse } from "node:http";
import { mountConnect, type ConnectApp } from "../src/index.js";

function createSimpleConnectApp(): ConnectApp {
  return {
    handle(req: IncomingMessage, res: ServerResponse, next?: (err?: unknown) => void) {
      if (req.url === "/handled") {
        res.statusCode = 200;
        res.setHeader("x-custom", "react-responded");
        res.end("React handled this");
      } else {
        next?.();
      }
    },
  };
}

describe("mountConnect via @pandaf/react re-export", () => {
  let app: Elysia;

  beforeAll(() => {
    const connectApp = createSimpleConnectApp();
    app = new Elysia({ adapter: node() })
      .use(mountConnect(connectApp))
      .get("/api/hello", () => "world")
      .post("/api/hello", ({ body }) => `posted: ${JSON.stringify(body)}`)
      .get("/api/user/:id", ({ params: { id } }) => `user-${id}`);
  });

  it("delegates to connect when connect handles the request", async () => {
    const res = await app.handle(
      new Request("http://localhost/handled", { method: "GET" }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("x-custom")).toBe("react-responded");
    const text = await res.text();
    expect(text).toContain("React handled this");
  });

  it("continues to Elysia when connect calls next()", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/hello", { method: "GET" }),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("world");
  });

  it("handles dynamic Elysia routes with path params", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/user/42", { method: "GET" }),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("user-42");
  });

  it("returns 404 for unknown routes", async () => {
    const res = await app.handle(
      new Request("http://localhost/nonexistent", { method: "GET" }),
    );
    expect(res.status).toBe(404);
  });

  it("handles POST with JSON body", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/hello", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ test: true }),
      }),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("posted");
  });

  it("preserves query parameters", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/hello?foo=bar", { method: "GET" }),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("world");
  });
});
