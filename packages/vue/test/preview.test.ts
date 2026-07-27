import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import vue from "@vitejs/plugin-vue";
import { createPandaf, GotenbergDriver } from "../src/index.js";
import { inlineAssetsPlugin } from "@pandaf/core";

const dir = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.resolve(dir, "fixtures/templates");

describe("previewHtml — explicit devServer (no HMR port)", () => {
  let devServer: Awaited<ReturnType<typeof createServer>>;
  let kit: ReturnType<typeof createPandaf>;

  beforeAll(async () => {
    devServer = await createServer({
      root: templatesDir,
      configFile: false,
      plugins: [vue(), inlineAssetsPlugin()],
      server: { middlewareMode: true },
      appType: "custom",
      css: { devSourcemap: false },
    });

    kit = createPandaf({
      templatesDir,
      driver: new GotenbergDriver("http://unused.local"),
      mode: "development",
      devServer,
    });
  });

  afterAll(async () => {
    await kit.close();
    await devServer.close();
  });

  it("renders a preview page with the template content", async () => {
    const html = await kit.previewHtml("Hello", { body: { name: "World" } });
    expect(html).toContain("Hello World");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('id="pandaf-page"');
  });

  it("includes the paper-size toolbar", async () => {
    const html = await kit.previewHtml("Hello", { body: { name: "X" } }, {
      paperSize: "letter",
    });
    expect(html).toContain("Letter");
    expect(html).toContain('id="pandaf-paper"');
    expect(html).toContain("pandaf-toolbar");
  });

  it("does not inject live-reload when hmr is not provided", async () => {
    const html = await kit.previewHtml("Hello", { body: { name: "X" } });
    expect(html).not.toContain("@vite/client");
  });

  it("injects @vite/client when hmr is true", async () => {
    const html = await kit.previewHtml("Hello", { body: { name: "X" } }, {
      hmr: true,
    });
    expect(html).toContain("@vite/client");
  });

  it("injects raw WebSocket for pandaf:reload when hmr is a port number", async () => {
    const html = await kit.previewHtml("Hello", { body: { name: "X" } }, {
      hmr: 5173,
    });
    expect(html).toContain("@vite/client");
    expect(html).toContain("ws://");
    expect(html).toContain("pandaf:reload");
  });

  it("renders a composite template with auto-paired header", async () => {
    const html = await kit.previewHtml("Card", {
      body: { name: "Preview Card" },
      header: {},
      options: {},
    });
    expect(html).toContain("Preview Card");
    expect(html).toContain("CARD HEADER");
    expect(html).toContain('class="pandaf-header"');
  });

  it("devServer getter returns the provided server", () => {
    expect(kit.devServer).toBe(devServer);
  });
});

describe("previewHtml — explicit devServer (views/ convention)", () => {
  const viewsDir = path.resolve(dir, "fixtures/templates-structured");
  let devServer: Awaited<ReturnType<typeof createServer>>;
  let kit: ReturnType<typeof createPandaf>;

  beforeAll(async () => {
    devServer = await createServer({
      root: viewsDir,
      configFile: false,
      plugins: [vue(), inlineAssetsPlugin()],
      server: { middlewareMode: true },
      appType: "custom",
      css: { devSourcemap: false },
    });

    kit = createPandaf({
      templatesDir: viewsDir,
      driver: new GotenbergDriver("http://unused.local"),
      mode: "development",
      devServer,
    });
  });

  afterAll(async () => {
    await kit.close();
    await devServer.close();
  });

  it("renders preview for views/ convention template", async () => {
    const html = await kit.previewHtml("receipt", { body: { total: 99.99 } });
    expect(html).toContain("99.99");
    expect(html).toContain('class="total"');
    expect(html).toContain("<!DOCTYPE html>");
  });
});
