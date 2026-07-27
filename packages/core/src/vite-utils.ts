import path from "node:path";

export interface PandafPluginOptions {
  templatesDir: string;
  outDir?: string;
  typesOut?: string;
  cssEntry?: string;
  preview?:
    | boolean
    | {
        basePath?: string;
        defaultPaperSize?: string;
      };
}

export function resolvePluginOpts(opts: PandafPluginOptions): {
  outDir: string;
  typesOut: string;
  cssEntry: string | undefined;
  cssDevOut: string | undefined;
} {
  const outDir = opts.outDir ?? "dist";
  const typesOut =
    opts.typesOut ?? path.resolve(process.cwd(), "src/generated/pandaf.d.ts");
  const cssEntry = opts.cssEntry ? path.resolve(opts.cssEntry) : undefined;
  const cssDevOut = cssEntry
    ? path.resolve(process.cwd(), ".pandaf", "pandaf.css")
    : undefined;
  return { outDir, typesOut, cssEntry, cssDevOut };
}
