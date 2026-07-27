import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { pandaf } from "../src/vite-plugin.js";
import { inlineAssetsPlugin } from "@pandaf/core";

const dir = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.resolve(dir, "fixtures/templates");
const templateFile = path.resolve(templatesDir, "Hello.tsx");

describe("HMR — pandaf plugin broadcasts via server.ws (react)", () => {
  let devServer: Awaited<ReturnType<typeof createServer>>;
  let sentMessages: any[] = [];

  beforeAll(async () => {
    devServer = await createServer({
      root: templatesDir,
      configFile: false,
      plugins: [
        react(),
        inlineAssetsPlugin(),
        pandaf({ templatesDir }),
      ],
      server: { middlewareMode: true },
      appType: "custom",
      css: { devSourcemap: false },
    });

    const origSend = devServer.ws.send.bind(devServer.ws);
    devServer.ws.send = (payload: any) => {
      sentMessages.push(payload);
      return origSend(payload);
    };
  });

  afterAll(async () => {
    await devServer?.close();
  });

  it("broadcasts pandaf:reload when a template is modified", async () => {
    sentMessages = [];

    const original = await fs.readFile(templateFile, "utf-8");
    try {
      await fs.writeFile(templateFile, `{/* hmr test ${Date.now()} */}\n${original}`);
      await new Promise((r) => setTimeout(r, 500));

      const reloadMsg = sentMessages.find(
        (m) => m.type === "custom" && m.event === "pandaf:reload",
      );
      expect(reloadMsg).toBeDefined();
      expect(reloadMsg.event).toBe("pandaf:reload");
    } finally {
      await fs.writeFile(templateFile, original);
    }
  });
});
