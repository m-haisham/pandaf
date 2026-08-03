import { PAPER_SIZES } from "./paper.js";
import type { PaperSize } from "./paper.js";

export { PAPER_SIZES } from "./paper.js";
export type { PaperSize } from "./paper.js";

const LS = "\n";

export interface PreviewHtmlOptions {
  paperSize?: PaperSize;
  /**
   * Pre-compiled CSS string to inline as a `<style>` tag (e.g. the Tailwind
   * output from `ssrLoadModule(cssEntry + "?inline")`). Accepts a raw CSS
   * string or a `Promise<string>` for convenience.
   */
  css?: string | Promise<string>;
  /**
   * When `true`, injects Vite's `@vite/client` script and registers a
   * `pandaf:reload` listener on Vite's HMR WebSocket (via `createHotContext`),
   * so the preview page live-reloads when a template changes. A `number` is
   * accepted for backward compatibility and behaves the same as `true`. Omit
   * or set to `false` to disable live reload.
   */
  hmr?: boolean | number;
  /**
   * URL for a "Download PDF" button in the toolbar.
   * Typically the consumer's PDF-generation endpoint so the developer can
   * download the result directly from the preview page.
   */
  downloadUrl?: string;
}

const SIZES_DATA = JSON.stringify(PAPER_SIZES);

function hmrClient(hmr?: boolean | number): string {
  if (!hmr) return "";
  const lines = ['<script type="module" src="/@vite/client"></script>'];
  lines.push(
    '<script type="module">',
    'import { createHotContext } from "/@vite/client";',
    'createHotContext("/__pandaf/preview").on("pandaf:reload", () => location.reload());',
    "\x3c/script>",
  );
  return lines.join(LS);
}

export async function buildPreviewHtml(
  content: string,
  options: PreviewHtmlOptions = {},
): Promise<string> {
  const paperSize = options.paperSize ?? "a4";
  const size = PAPER_SIZES[paperSize];

  // Resolve the compiled CSS string (accepts raw string or Promise).
  let cssStyle = "";
  if (options.css) {
    const cssText = await Promise.resolve(options.css);
    if (cssText) {
      cssStyle = "<style>" + cssText + "</style>";
    }
  }

  const optionsHtml = Object.entries(PAPER_SIZES)
    .map(
      ([k, v]) =>
        '<option value="' +
        k +
        '"' +
        (k === paperSize ? " selected" : "") +
        ">" +
        v.label +
        "</option>",
    )
    .join(LS);

  const script = [
    "(function(){",
    '  var page = document.getElementById("pandaf-page");',
    '  var sel = document.getElementById("pandaf-paper");',
    '  var dim = document.getElementById("pandaf-dim");',
    '  var dl = document.querySelector(".pandaf-download");',
    "  var sizes = " + SIZES_DATA + ";",
    "  var downloadUrl = " +
      (options.downloadUrl ? JSON.stringify(options.downloadUrl) : "null") +
      ";",
    "  var PX_PER_MM = 3.7795;",
    "",
    "  function update() {",
    "    var s = sizes[sel.value];",
    "    var vw = window.innerWidth;",
    "    var maxW = Math.min(vw - 64, 1200);",
    "    var scale = Math.min(maxW / (s.width * PX_PER_MM), 1.2);",
    '    page.style.width = Math.round(s.width * PX_PER_MM * scale) + "px";',
    '    dim.textContent = s.width + " \\u00d7 " + s.height + " mm";',
    "  }",
    "",
    "  function updateDownload() {",
    "    if (!dl || !downloadUrl) return;",
    '    var sep = downloadUrl.indexOf("?") >= 0 ? "&" : "?";',
    '    dl.href = downloadUrl + sep + "paperSize=" + encodeURIComponent(sel.value);',
    "  }",
    "",
    "  update();",
    "  updateDownload();",
    '  sel.addEventListener("change", function() { update(); updateDownload(); });',
    '  window.addEventListener("resize", update);',
    "})();",
  ].join(LS);

  return [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    "<title>pandaf Preview</title>",
    cssStyle,
    "<style>",
    "  body { background: #e5e7eb; margin: 0; display: flex; flex-direction: column; align-items: center; padding: 72px 16px 48px; }",
    "  .pandaf-toolbar {",
    "    position: fixed; top: 0; left: 0; right: 0; z-index: 100;",
    "    height: 48px; background: #1f2937; color: #f9fafb;",
    "    display: flex; align-items: center; gap: 12px;",
    "    padding: 0 16px; font-size: 14px;",
    "  }",
    "  .pandaf-toolbar label { color: #9ca3af; }",
    "  .pandaf-toolbar select {",
    "    background: #374151; color: #f9fafb;",
    "    border: 1px solid #4b5563; border-radius: 4px;",
    "    padding: 4px 8px; font-size: 13px;",
    "  }",
    "  .pandaf-toolbar .pandaf-dim { color: #6b7280; font-size: 12px; }",
    "  .pandaf-toolbar .pandaf-spacer { flex: 1; }",
    "  .pandaf-toolbar .pandaf-download {",
    "    background: #059669; color: #fff;",
    "    border: none; border-radius: 4px;",
    "    padding: 5px 12px; font-size: 13px; cursor: pointer;",
    "    text-decoration: none; line-height: normal;",
    "  }",
    "  .pandaf-toolbar .pandaf-download:hover { background: #047857; }",
    "  .pandaf-page {",
    "    background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,.15);",
    "    transition: width .2s; min-height: 200px;",
    "  }",
    "  .pandaf-page :is(header,.pandaf-header) { page-break-after: avoid; break-after: avoid; }",
    "  .pandaf-page :is(footer,.pandaf-footer) { page-break-before: avoid; break-before: avoid; }",
    "</style>",
    "</head>",
    "<body>",
    '<div class="pandaf-toolbar">',
    '  <label for="pandaf-paper">Paper:</label>',
    '  <select id="pandaf-paper">',
    optionsHtml,
    "  </select>",
    '  <span class="pandaf-dim" id="pandaf-dim">' +
      size.width +
      " &times; " +
      size.height +
      " mm</span>",
    '  <span class="pandaf-spacer"></span>',
    (options.downloadUrl
      ? '<a class="pandaf-download" href="' +
        options.downloadUrl +
        '">Download PDF</a>'
      : ""),
    "</div>",
    '<div class="pandaf-page" id="pandaf-page">',
    "    " + content,
    "  </div>",
    "</div>",
    "<script>" + script + "\x3c/script>",
    hmrClient(options.hmr),
    "</body>",
    "</html>",
  ].join(LS);
}
