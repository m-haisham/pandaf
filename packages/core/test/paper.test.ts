import { describe, it, expect } from "vitest";
import { resolvePaperDims, PAPER_SIZES } from "../src/paper.js";

describe("PAPER_SIZES", () => {
  it("includes common portrait sizes in millimetres", () => {
    expect(PAPER_SIZES.a4).toEqual({ width: 210, height: 297, label: "A4" });
    expect(PAPER_SIZES.letter).toEqual({ width: 216, height: 279, label: "Letter" });
    expect(PAPER_SIZES.legal).toEqual({ width: 216, height: 356, label: "Legal" });
  });
});

describe("resolvePaperDims", () => {
  it("defaults to A4 in inches with a Puppeteer format", () => {
    expect(resolvePaperDims()).toEqual({
      paperWidth: 8.27,
      paperHeight: 11.69,
      format: "A4",
    });
  });

  it("resolves a named size to inches and an uppercase Puppeteer format", () => {
    expect(resolvePaperDims({ paperSize: "letter" })).toEqual({
      paperWidth: 8.5,
      paperHeight: 10.98,
      format: "LETTER",
    });
  });

  it("is case-insensitive for the paper size name", () => {
    expect(resolvePaperDims({ paperSize: "A4" }).format).toBe("A4");
    expect(resolvePaperDims({ paperSize: "LEGAL" }).paperHeight).toBe(14.02);
  });

  it("returns custom width/height as-is without a Puppeteer format", () => {
    expect(resolvePaperDims({ paperWidth: 6, paperHeight: 4 })).toEqual({
      paperWidth: 6,
      paperHeight: 4,
      format: undefined,
    });
  });

  it("defaults a missing width or height to the A4 dimension", () => {
    expect(resolvePaperDims({ paperWidth: 6 })).toEqual({
      paperWidth: 6,
      paperHeight: 11.69,
      format: undefined,
    });
    expect(resolvePaperDims({ paperHeight: 4 })).toEqual({
      paperWidth: 8.27,
      paperHeight: 4,
      format: undefined,
    });
  });

  it("ignores paperSize when custom dimensions are given", () => {
    expect(resolvePaperDims({ paperSize: "letter", paperWidth: 6, paperHeight: 4 })).toEqual({
      paperWidth: 6,
      paperHeight: 4,
      format: undefined,
    });
  });

  it("falls back to A4 for unknown size names", () => {
    expect(resolvePaperDims({ paperSize: "bogus" })).toEqual({
      paperWidth: 8.27,
      paperHeight: 11.69,
      format: "A4",
    });
  });
});
