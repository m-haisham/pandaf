import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import vue from "@vitejs/plugin-vue";
import { pandaf } from "../src/vite-plugin.js";
import { inlineAssetsPlugin } from "@pandaf/core";

const dir = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.resolve(dir, "fixtures/templates");
const templateFile = path.resolve(templatesDir, "Hello.vue");

describe("HMR — pandaf plugin broadcasts via server.ws", () => {
  let devServer: Awaited<ReturnType<typeof createServer>>;
  let sentMessages: any[] = [];

  beforeAll(async () => {
    devServer = await createServer({
      root: templatesDir,
      configFile: false,
      plugins: [
        vue(),
        inlineAssetsPlugin(),
        pandaf({ templatesDir }),
      ],
      server: { middlewareMode: true, hmr: { port: 5313 } },
      appType: "custom",
      css: { devSourcemap: false },
    });

    // Intercept server.ws.send to capture broadcasts
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

    // Drive the plugin's own "change" handler directly instead of writing the
    // file and waiting on a real chokidar event: native/polling fs watching
    // is unreliable across OSes and CI runners (confirmed flaky even
    // locally), and pandaf's wiring — not chokidar's delivery — is what this
    // test is verifying.
    devServer.watcher.emit("change", templateFile);

    const deadline = Date.now() + 2000;
    let reloadMsg: any;
    while (Date.now() < deadline) {
      reloadMsg = sentMessages.find(
        (m) => m.type === "custom" && m.event === "pandaf:reload",
      );
      if (reloadMsg) break;
      await new Promise((r) => setTimeout(r, 10));
    }

    expect(reloadMsg).toBeDefined();
    expect(reloadMsg.event).toBe("pandaf:reload");
  }, 5000);
});
