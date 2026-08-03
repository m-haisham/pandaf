export { Cache, DEFAULT_TTL_MS } from "./cache/types.js";
export { NoopCache } from "./cache/noop.js";
export { InMemoryCache } from "./cache/memory.js";
export { RedisCache, type RedisClient } from "./cache/redis.js";

export {
  PdfDriver,
  GotenbergDriver,
  ChromiumDriver,
  ChromiumMeasurer,
  PuppeteerMeasurer,
  resolveMargins,
} from "./drivers/index.js";
export type {
  DriverRenderInput,
  ChromiumDriverOptions,
  PuppeteerBrowser,
  PuppeteerPage,
  MarginInput,
} from "./drivers/index.js";

export { wrapBody, wrapHeader, wrapFooter } from "./html.js";

export {
  inlineAssetsPlugin,
  inlineCssAssets,
  inlineHtmlAssets,
} from "./inline-assets.js";

export { buildPreviewHtml, PAPER_SIZES } from "./preview.js";
export type { PreviewHtmlOptions, PaperSize } from "./preview.js";

export { resolvePaperDims } from "./paper.js";
export type { PaperOptions, ResolvedPaperSize } from "./paper.js";

export type {
  TemplateKind,
  DiscoveredLayout,
  Discovery,
  PdfManifest,
} from "./layout.js";

export {
  createDevRenderer,
  createProdRenderer,
  type RenderMod,
  type PandafRenderer,
} from "./renderer.js";

export {
  resolvePluginOpts,
  type PandafPluginOptions,
} from "./vite-utils.js";
