// Prod renderer: static import from dist/ (bundled ahead of time, per §3.5).
import { renderPdfBody } from "../../dist/entry-server.js";

export async function renderProd(
  template: string,
  data: unknown,
): Promise<string> {
  return renderPdfBody(template, data);
}
