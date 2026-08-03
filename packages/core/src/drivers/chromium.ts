import { PdfDriver, type DriverRenderInput } from "./types.js";
import { resolvePaperDims } from "../paper.js";

export interface ChromiumDriverOptions {
  /**
   * Connect to a **remote** Chromium instead of launching a local one. Provide
   * either a WebSocket endpoint (`ws://host:3000`) or an HTTP frontend URL
   * (`http://host:9222`) — typically a browserless.io or `browserless/chromium`
   * Docker container. When set, `launchArgs`/`executablePath` are ignored and
   * the driver calls `puppeteer.connect()` rather than `puppeteer.launch()`.
   */
  browserWSEndpoint?: string;
  /** Alias for `browserWSEndpoint` accepting an HTTP `browserURL` too. */
  browserURL?: string;
  /** Path to a Chrome/Chromium executable (local launch only). Falls back to Puppeteer's bundled browser. */
  executablePath?: string;
  /** Launch args passed to the browser (e.g. sandbox toggles in containers). Ignored when connecting remotely. */
  launchArgs?: string[];
  /** Reuse a single browser across renders; closed in `close()`. Default true. */
  reuseBrowser?: boolean;
}

export interface PuppeteerPage {
  setContent(html: string, options: { waitUntil: string }): Promise<void>;
  evaluate(
    fn: (...args: never[]) => unknown,
    ...args: unknown[]
  ): Promise<unknown>;
  evaluate<T>(fn: () => T): Promise<T>;
  pdf(options: Record<string, unknown>): Promise<Uint8Array>;
  setViewport(options: { width: number; height: number }): Promise<void>;
  close(): Promise<void>;
  browser(): PuppeteerBrowser;
}

export interface PuppeteerBrowser {
  newPage(): Promise<PuppeteerPage>;
  close(): Promise<void>;
  disconnect(): Promise<void>;
}

interface PuppeteerModule {
  launch(options: Record<string, unknown>): Promise<PuppeteerBrowser>;
  connect(options: Record<string, unknown>): Promise<PuppeteerBrowser>;
}

/** Local Chromium driver backed by Puppeteer (optional peer dependency). */
export class ChromiumDriver extends PdfDriver {
  readonly name = "chromium";

  private browser: PuppeteerBrowser | null = null;
  private readonly browserWSEndpoint?: string;
  private readonly browserURL?: string;
  private readonly executablePath?: string;
  private readonly launchArgs: readonly string[];
  private readonly reuseBrowser: boolean;
  private readonly connected: boolean;

  constructor(options: ChromiumDriverOptions = {}) {
    super();
    this.browserWSEndpoint = options.browserWSEndpoint;
    this.browserURL = options.browserURL;
    this.executablePath = options.executablePath;
    this.launchArgs = options.launchArgs ?? [
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ];
    this.reuseBrowser = options.reuseBrowser ?? true;
    this.connected = Boolean(this.browserWSEndpoint || this.browserURL);
  }

  private async getPuppeteer(): Promise<PuppeteerModule> {
    try {
      return (await import("puppeteer")) as PuppeteerModule;
    } catch {
      try {
        return (await import("puppeteer-core")) as PuppeteerModule;
      } catch {
        throw new Error(
          "The 'chromium' driver requires 'puppeteer' (or 'puppeteer-core') " +
            "to be installed. Install it with `pnpm add puppeteer`, or use the " +
            "'gotenberg' driver instead.",
        );
      }
    }
  }

  private async getBrowserInternal(): Promise<PuppeteerBrowser> {
    if (this.browser) return this.browser;
    const puppeteer = await this.getPuppeteer();
    if (this.connected) {
      this.browser = await puppeteer.connect({
        browserWSEndpoint: this.browserWSEndpoint,
        browserURL: this.browserURL,
      });
    } else {
      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: this.executablePath,
        args: this.launchArgs,
      });
    }
    return this.browser;
  }

  /** Returns the underlying Puppeteer Browser instance, creating it if needed. */
  async getBrowser(): Promise<PuppeteerBrowser> {
    return this.getBrowserInternal();
  }

  async render(input: DriverRenderInput): Promise<ReadableStream> {
    const browser = await this.getBrowserInternal();
    const page = await browser.newPage();
    try {
      await page.setContent(input.body, { waitUntil: "networkidle0" });

      if (input.header || input.footer) {
        await page.evaluate(
          (h: string, f: string) => {
            const root = document.body;
            if (h) {
              const el = document.createElement("div");
              el.className = "pandaf-header";
              el.innerHTML = h;
              root.prepend(el);
            }
            if (f) {
              const el = document.createElement("div");
              el.className = "pandaf-footer";
              el.innerHTML = f;
              root.append(el);
            }
          },
          input.header ?? "",
          input.footer ?? "",
        );
      }

      const size = resolvePaperDims({
        paperSize: input.paperSize,
        paperWidth: input.paperWidth,
        paperHeight: input.paperHeight,
      });

      const pdf: Uint8Array = await page.pdf({
        printBackground: input.backgroundGraphics ?? true,
        ...(size.format
          ? { format: size.format }
          : {
              width: `${size.paperWidth}in`,
              height: `${size.paperHeight}in`,
            }),
        marginTop: input.marginTop ?? 0,
        marginBottom: input.marginBottom ?? 0,
        marginLeft: input.marginLeft,
        marginRight: input.marginRight,
      });

      return new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(pdf));
          controller.close();
        },
      });
    } finally {
      if (!this.reuseBrowser) {
        await page.browser().close();
      } else {
        await page.close();
      }
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      if (this.connected) {
        await this.browser.disconnect();
      } else {
        await this.browser.close();
      }
      this.browser = null;
    }
  }
}
