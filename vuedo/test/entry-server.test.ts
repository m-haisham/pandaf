import { describe, it, expect } from "vitest";
import { renderPdfBody } from "../src/entry-server";

describe("renderPdfBody (prod renderer path, no dist build needed)", () => {
  it("renders a known template to an HTML string", async () => {
    const html = await renderPdfBody("Invoice", {
      id: "INV-0002",
      customerName: "Globex",
    });
    expect(html).toContain("INV-0002");
    expect(html).toContain("Globex");
  });

  it("throws on an unknown template", async () => {
    await expect(renderPdfBody("Nope", {})).rejects.toThrow(/Unknown template/);
  });
});
