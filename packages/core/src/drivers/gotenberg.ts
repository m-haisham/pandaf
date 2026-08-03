import { PdfDriver, type DriverRenderInput } from "./types.js";
import { resolvePaperDims } from "../paper.js";

// Gotenberg driver: posts the (already asset-inlined) HTML plus optional
// header/footer documents to Gotenberg's Chromium HTML route and streams the
// resulting PDF bytes straight back to the caller. Requires a reachable
// Gotenberg instance (typically `docker compose up`).
export class GotenbergDriver extends PdfDriver {
  readonly name = "gotenberg";

  constructor(private readonly baseUrl: string) {
    super();
  }

  async render(input: DriverRenderInput): Promise<ReadableStream> {
    const form = new FormData();
    form.append("files", new Blob([input.body], { type: "text/html" }), "index.html");
    if (input.header) {
      form.append("files", new Blob([input.header], { type: "text/html" }), "header.html");
    }
    if (input.footer) {
      form.append("files", new Blob([input.footer], { type: "text/html" }), "footer.html");
    }
    form.append("marginTop", String(input.marginTop ?? 0));
    form.append("marginBottom", String(input.marginBottom ?? 0));
    if (input.marginLeft !== undefined) form.append("marginLeft", String(input.marginLeft));
    if (input.marginRight !== undefined) form.append("marginRight", String(input.marginRight));
    const size = resolvePaperDims({
      paperSize: input.paperSize,
      paperWidth: input.paperWidth,
      paperHeight: input.paperHeight,
    });
    form.append("paperWidth", String(size.paperWidth));
    form.append("paperHeight", String(size.paperHeight));
    form.append("backgroundGraphics", String(input.backgroundGraphics ?? true));

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/forms/chromium/convert/html`, {
        method: "POST",
        body: form,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to connect to Gotenberg at ${this.baseUrl}. ` +
          `Is the service running? (${message})`,
      );
    }

    if (!res.ok) {
      throw new Error(
        `Gotenberg conversion failed (${res.status} ${res.statusText})`,
      );
    }
    if (!res.body) {
      throw new Error("Gotenberg conversion succeeded but returned an empty body");
    }
    return res.body;
  }
}
