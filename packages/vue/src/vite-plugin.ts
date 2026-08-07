import fs from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";
import { discoverLayouts } from "./discover.js";
import { writeManifest } from "./manifest.js";
import { generateTypes } from "./types.js";
import {
  inlineAssetsPlugin,
  buildPreviewHtml,
  type PaperSize,
} from "@pandaf/core";
import { renderComponent } from "./render-component.js";
import { resolvePluginOpts, type PandafPluginOptions } from "@pandaf/core";

export type { PandafPluginOptions };

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export function pandaf(opts: PandafPluginOptions): Plugin {
  const { outDir, typesOut, cssEntry, cssDevOut } = resolvePluginOpts(opts);

  const previewEnabled = opts.preview !== undefined && opts.preview !== false;
  const previewBase =
    opts.preview === true || typeof opts.preview === "boolean"
      ? "/__pandaf"
      : (opts.preview?.basePath ?? "/__pandaf");
  const defaultPaperSize: PaperSize =
    opts.preview === true || typeof opts.preview === "boolean"
      ? "a4"
      : (opts.preview?.defaultPaperSize ?? "a4");

  let discovery: Awaited<ReturnType<typeof discoverLayouts>> | undefined;
  let discoveryCache: Promise<void> | undefined;

  async function getDiscovery() {
    if (!discovery) {
      const p = discoverLayouts(opts.templatesDir);
      discoveryCache ??= p.then((d) => {
        discovery = d;
      });
      await discoveryCache;
    }
    return discovery!;
  }

  async function ssrRenderSection(
    server: import("vite").ViteDevServer,
    templateName: string,
    data: unknown,
  ): Promise<string> {
    const disc = await getDiscovery();
    const file = disc.entries[templateName];
    if (!file) throw new Error("Unknown template: " + templateName);
    const root = server.config.root;
    const rel = path.relative(root, file);
    const url = rel.startsWith("..")
      ? "/@fs/" + file
      : "/" + rel.split(path.sep).join("/");
    const mod = await server.ssrLoadModule(url);
    return renderComponent(mod, data);
  }

  return {
    name: "pandaf",
    async configureServer(server) {
      void generateTypes(opts.templatesDir, typesOut).catch(() => {});

      const watcher = server.watcher;
      watcher.add(opts.templatesDir);

      // -----------------------------------------------------------------------
      // File-watcher: re-generate types on every template add/remove/change,
      // re-compile CSS on template/CSS changes, and notify HMR clients.
      // -----------------------------------------------------------------------

      const onTemplateChange = async () => {
        discovery = undefined;
        await generateTypes(opts.templatesDir, typesOut).catch(() => {});

        try {
          server.ws.send({
            type: "custom",
            event: "pandaf:reload",
            data: {},
          });
        } catch {
          /* Vite WebSocket may not be available in middleware-only mode */
        }
      };

      if (cssEntry && cssDevOut) {
        const cssPath = cssEntry.startsWith("/")
          ? cssEntry
          : "/" + path.relative(server.config.root, cssEntry);

        const writeCss = async () => {
          try {
            const mod = await server.ssrLoadModule(cssPath + "?inline");
            const css = (mod as { default?: string }).default ?? "";
            await fs.mkdir(path.dirname(cssDevOut), { recursive: true });
            await fs.writeFile(cssDevOut, css);
          } catch (e) {
            console.error("[pandaf] Failed to compile CSS:", e);
          }
        };

        await writeCss();

        watcher.on("change", (file: string) => {
          if (file === cssEntry || file.startsWith(opts.templatesDir)) {
            void writeCss();
            void onTemplateChange();
          }
        });
      } else {
        watcher.on("change", () => void onTemplateChange());
      }

      watcher.on("add", () => void onTemplateChange());
      watcher.on("unlink", () => void onTemplateChange());

      // -----------------------------------------------------------------------
      // Preview middleware
      // -----------------------------------------------------------------------

      if (!previewEnabled) return;

      server.middlewares.use(
        previewBase + "/preview",
        async (req, res, next) => {
          if (req.method !== "GET") return next();

          const qIndex = (req.url ?? "").indexOf("?");
          const pathname =
            qIndex >= 0 ? (req.url ?? "").slice(0, qIndex) : (req.url ?? "");
          const templateName = pathname.replace(/^\//, "").replace(/-/g, ".");
          if (!templateName) return next();

          try {
            const disc = await getDiscovery();
            const layout = disc.layouts[templateName];
            if (!layout) {
              res.statusCode = 404;
              res.end("Template not found: " + templateName);
              return;
            }

            const body = await ssrRenderSection(server, layout.body, {});
            const header = layout.header
              ? await ssrRenderSection(server, layout.header, {})
              : null;
            const footer = layout.footer
              ? await ssrRenderSection(server, layout.footer, {})
              : null;

            const sections = [
              header ? '<div class="pandaf-header">' + header + "</div>" : "",
              '<div class="pandaf-body">' + body + "</div>",
              footer ? '<div class="pandaf-footer">' + footer + "</div>" : "",
            ].join("\n");

            // Compile Tailwind CSS via the running Vite server.
            let css = "";
            if (cssEntry) {
              try {
                const cssPath = cssEntry.startsWith("/")
                  ? cssEntry
                  : "/" + path.relative(server.config.root, cssEntry);
                const mod = await server.ssrLoadModule(cssPath + "?inline");
                css = (mod as { default?: string }).default ?? "";
              } catch {
                /* CSS may not be configured; proceed without it */
              }
            }
            const hmrConfig = server.config.server.hmr;
            const hmrPort =
              typeof hmrConfig === "object" ? hmrConfig?.port : undefined;
            const html = await buildPreviewHtml(sections, {
              paperSize: defaultPaperSize,
              css,
              hmr: typeof hmrPort === "number" ? hmrPort : undefined,
            });

            res.statusCode = 200;
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(html);
          } catch (err) {
            console.error("[pandaf] Preview error:", err);
            res.statusCode = 500;
            res.end("Preview error: " + String(err));
          }
        },
      );
    },
    async config(_userConfig, { command }) {
      if (command !== "build") return;
      const disc = await discoverLayouts(opts.templatesDir);
      return {
        plugins: [inlineAssetsPlugin()],
        build: { ssr: true, rollupOptions: { input: disc.entries } },
      };
    },
    async closeBundle() {
      await writeManifest(opts.templatesDir, outDir);
      await generateTypes(opts.templatesDir, typesOut);

      if (cssEntry) {
        await compileAndSaveCss(cssEntry, outDir);
      }
    },
  };
}

async function compileAndSaveCss(
  cssEntry: string,
  outDir: string,
): Promise<void> {
  const { createServer, loadConfigFromFile } = await import("vite");

  // Load the consumer's vite.config.* so their plugins (Tailwind,
  // component libraries, path aliases, etc.) are active. We create a
  // dev server (command: "serve") so we can ssrLoadModule the CSS entry.
  const loaded = await loadConfigFromFile(
    { command: "serve", mode: "production" },
    undefined,
    process.cwd(),
  );

  // Drop the pandaf plugin itself to avoid recursion / side-effects
  // (configureServer hooks, watchers, etc.) on this temp server.
  const userPlugins = (loaded?.config?.plugins ?? [])
    .flat()
    .filter(isPlugin)
    .filter((plugin) => plugin.name !== "pandaf");

  const server = await createServer({
    ...loaded?.config,
    configFile: false,
    plugins: userPlugins,
    server: { middlewareMode: true },
    appType: "custom",
    css: { devSourcemap: false },
  });

  try {
    const cssPath =
      "/" + path.relative(server.config.root, path.resolve(cssEntry));
    const mod = await server.ssrLoadModule(cssPath + "?inline");
    const css = (mod as { default?: string }).default ?? "";

    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.resolve(outDir, "pandaf.css"), css);
  } finally {
    await server.close();
  }
}

function isPlugin(value: unknown): value is Plugin {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { name?: unknown }).name === "string"
  );
}

export default pandaf;
