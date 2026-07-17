import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ViteDevServer } from "vite";
import { renderComponent } from "./render-component.js";
import { discoverLayouts, type Discovery } from "./discover.js";
import { loadManifest, type PdfManifest } from "./manifest.js";
import { inlineAssetsPlugin } from "./inline-assets.js";

export interface VuedoRenderer {
  render(name: string, data: unknown): Promise<string>;
  layoutOf(name: string): Promise<{ header?: string; footer?: string }>;
  resolveCss(): Promise<string>;
  close(): Promise<void>;
}

// ---------------------------------------------------------------------------
// DevRenderer — owned Vite SSR (booted in-process, always works)
// ---------------------------------------------------------------------------

let ownedVite: ViteDevServer | undefined;
let ownedCssEntry: string | undefined;

async function createOwnedVite(
  templatesDir: string,
  cssEntry?: string,
): Promise<ViteDevServer> {
  const { createServer } = await import("vite");
  const vue = (await import("@vitejs/plugin-vue")).default;
  const plugins: any[] = [vue(), inlineAssetsPlugin()];
  if (cssEntry) {
    const tailwindcss = (await import("@tailwindcss/vite")).default;
    plugins.unshift(tailwindcss());
  }
  const root = path.resolve(templatesDir);
  const fsAllow = [root];
  if (cssEntry) fsAllow.push(path.dirname(path.resolve(cssEntry)));
  return createServer({
    root,
    configFile: false,
    plugins,
    server: { middlewareMode: true, fs: { allow: fsAllow } },
    appType: "custom",
    css: { devSourcemap: false },
  });
}

export function createDevRenderer(
  templatesDir: string,
  cssEntry?: string,
  cssOutput?: string,
): VuedoRenderer {
  let discovery: Discovery | undefined;

  async function ensure(): Promise<{
    render(name: string, data: unknown): Promise<string>;
  }> {
    if (!discovery) {
      discovery = await discoverLayouts(templatesDir);
      ownedVite ??= await createOwnedVite(templatesDir, cssEntry);
      if (cssEntry) ownedCssEntry = cssEntry;
    }

    function urlFor(name: string): string {
      const file = discovery!.entries[name];
      if (!file) throw new Error(`Unknown template: ${name}`);
      return "/" + path.relative(templatesDir, file).split(path.sep).join("/");
    }

    return {
      async render(name, data) {
        const mod = await ownedVite!.ssrLoadModule(urlFor(name));
        return renderComponent(mod, data);
      },
    };
  }

  async function resolveCss(): Promise<string> {
    await ensure();

    if (cssOutput) {
      try {
        return await fs.readFile(cssOutput, "utf-8");
      } catch {
        console.warn(`[vuedo] Failed to read CSS output from ${cssOutput}`);
      }
    }

    if (ownedCssEntry && ownedVite) {
      try {
        const absEntry = path.resolve(ownedCssEntry);
        const rel = path.relative(ownedVite.config.root, absEntry);
        const cssUrl = "/" + rel.split(path.sep).join("/");
        const mod = await ownedVite.ssrLoadModule(cssUrl + "?inline");
        return (mod as { default?: string }).default ?? "";
      } catch {
        return "";
      }
    }

    return "";
  }

  return {
    async render(name, data) {
      const { render } = await ensure();
      return render(name, data);
    },
    async layoutOf(name) {
      await ensure();
      return discovery!.layouts[name] ?? {};
    },
    resolveCss,
    async close() {
      if (ownedVite) {
        await ownedVite.close();
        ownedVite = undefined;
        ownedCssEntry = undefined;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// ProdRenderer — pre-compiled SSR modules from the build manifest
// ---------------------------------------------------------------------------

export function createProdRenderer(
  manifestPath: string,
  cssOutput: string,
): VuedoRenderer {
  let manifest: PdfManifest | undefined;
  let cssCache: string | null = null;

  async function ensure(): Promise<PdfManifest> {
    if (!manifest) manifest = await loadManifest(manifestPath);
    return manifest;
  }

  return {
    async render(name, data) {
      const m = await ensure();
      const modPath = m.entries[name];
      if (!modPath) throw new Error(`Unknown template: ${name}`);
      const mod = await import(pathToFileURL(modPath).href);
      return renderComponent(mod, data);
    },
    async layoutOf(name) {
      const m = await ensure();
      return m.layouts[name] ?? {};
    },
    async resolveCss() {
      if (cssCache !== null) return cssCache;
      try {
        cssCache = await fs.readFile(cssOutput, "utf-8");
      } catch {
        cssCache = "";
      }
      return cssCache;
    },
    async close() {
      manifest = undefined;
      cssCache = null;
    },
  };
}
