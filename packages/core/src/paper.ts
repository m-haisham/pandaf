// Shared paper-size model. Both PDF drivers and the live-preview page builder
// derive their geometry from this single table, so a size picked in the
// preview toolbar maps to the exact same dimensions when the PDF is rendered.

/** Standard paper sizes in millimetres (portrait orientation). */
export const PAPER_SIZES = {
  a0: { width: 841, height: 1189, label: "A0" },
  a1: { width: 594, height: 841, label: "A1" },
  a2: { width: 420, height: 594, label: "A2" },
  a3: { width: 297, height: 420, label: "A3" },
  a4: { width: 210, height: 297, label: "A4" },
  a5: { width: 148, height: 210, label: "A5" },
  a6: { width: 105, height: 148, label: "A6" },
  letter: { width: 216, height: 279, label: "Letter" },
  legal: { width: 216, height: 356, label: "Legal" },
  tabloid: { width: 279, height: 432, label: "Tabloid" },
} as const;

export type PaperSize = keyof typeof PAPER_SIZES;

/** Millimetres per inch — used to convert the table above for inch-based APIs. */
const MM_PER_INCH = 25.4;

function mmToInches(mm: number): number {
  return Math.round((mm / MM_PER_INCH) * 100) / 100;
}

export interface PaperOptions {
  /** Named paper size (case-insensitive). Ignored when custom `paperWidth`/`paperHeight` are given. */
  paperSize?: PaperSize | string;
  /** Custom paper width in inches. When only one of width/height is given, the other defaults to A4. */
  paperWidth?: number;
  /** Custom paper height in inches. When only one of width/height is given, the other defaults to A4. */
  paperHeight?: number;
}

export interface ResolvedPaperSize {
  /** Paper width in inches (always resolved — falls back to A4). */
  paperWidth: number;
  /** Paper height in inches (always resolved — falls back to A4). */
  paperHeight: number;
  /**
   * Puppeteer page.pdf format name (e.g. "A4", "Letter"), present when the
   * size came from a named `paperSize` or the A4 default — never set for fully
   * custom `paperWidth`/`paperHeight` (Puppeteer rejects `format` alongside
   * custom `width`/`height`).
   */
  format?: string;
}

/**
 * Resolves paper geometry from either a named `paperSize` or custom
 * `paperWidth`/`paperHeight` (inches). Named sizes resolve to inches AND a
 * Puppeteer `format`; custom dimensions resolve to inches only. Unknown names
 * and missing input fall back to A4.
 */
export function resolvePaperDims(options: PaperOptions = {}): ResolvedPaperSize {
  const { paperSize, paperWidth, paperHeight } = options;
  const a4 = PAPER_SIZES.a4;

  if (paperWidth !== undefined || paperHeight !== undefined) {
    return {
      paperWidth: paperWidth ?? mmToInches(a4.width),
      paperHeight: paperHeight ?? mmToInches(a4.height),
    };
  }

  if (paperSize) {
    const key = String(paperSize).toLowerCase() as PaperSize;
    const size = PAPER_SIZES[key];
    if (size) {
      return {
        paperWidth: mmToInches(size.width),
        paperHeight: mmToInches(size.height),
        format: key.toUpperCase(),
      };
    }
  }

  return {
    paperWidth: mmToInches(a4.width),
    paperHeight: mmToInches(a4.height),
    format: "A4",
  };
}
