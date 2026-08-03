// A PDF driver turns already SSR-rendered, asset-inlined HTML (a body plus
// optional header/footer documents) into a stream of PDF bytes. Pandaf ships
// two drivers — Gotenberg (remote Chromium service) and Chromium (local
// Puppeteer) — but the interface is intentionally small so additional backends
// (e.g. a cloud render API, a different headless engine) can be dropped in
// later without touching the core.

import type { PaperSize } from "../paper.js";

export interface DriverRenderInput {
  /** Body HTML, already wrapped + asset-inlined. */
  body: string;
  /** Header document HTML, if the template has a paired header. */
  header?: string;
  /** Footer document HTML, if the template has a paired footer. */
  footer?: string;
  /** Page margins in inches. */
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  /**
   * Named paper size (e.g. "a4", "letter"). Ignored when custom
   * `paperWidth`/`paperHeight` are supplied. Defaults to A4.
   */
  paperSize?: PaperSize;
  /** Custom paper width in inches (Gotenberg) / Puppeteer `width` when no format is used. */
  paperWidth?: number;
  /** Custom paper height in inches (Gotenberg) / Puppeteer `height` when no format is used. */
  paperHeight?: number;
  /** Print background graphics (CSS backgrounds, images). Defaults to true. */
  backgroundGraphics?: boolean;
}

export abstract class PdfDriver {
  constructor() {
    // `abstract` is erased at runtime by TS, so enforce it here: the base
    // class is not meant to be instantiated directly.
    if (new.target === PdfDriver) {
      throw new Error(
        "PdfDriver is abstract and cannot be instantiated directly",
      );
    }
  }

  /** Human-readable name, used in logs/errors (e.g. "gotenberg"). */
  abstract readonly name: string;

  /**
   * Convert the given HTML sections into a PDF. Implementations own whatever
   * connection/process lifecycle they need; `close()` tears it down.
   */
  abstract render(input: DriverRenderInput): Promise<ReadableStream>;

  /** Release any resources (browser instances, connections). Optional. */
  async close(): Promise<void> {}
}
