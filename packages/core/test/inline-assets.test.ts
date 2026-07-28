import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  inlineAssetsPlugin,
  inlineCssAssets,
  inlineHtmlAssets,
} from "../src/inline-assets.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "pandaf-inline-assets-"));
}

async function writeFixture(
  dir: string,
  relativePath: string,
  data: string | Buffer,
): Promise<string> {
  const full = path.resolve(dir, relativePath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
  return full;
}

function makePng(): Buffer {
  // Minimal valid 1x1 PNG (89 50 4E 47 …)
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
    0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00,
    0xff, 0xff, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0x25, 0x1f, 0x04, 0x36,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

// ---------------------------------------------------------------------------
// inlineAssetsPlugin (Vite load hook)
// ---------------------------------------------------------------------------

describe("inlineAssetsPlugin", () => {
  let tmpDir: string;
  const plugin = inlineAssetsPlugin();

  beforeAll(async () => {
    tmpDir = await makeTempDir();
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("inlines a PNG as a data URI", async () => {
    const file = await writeFixture(tmpDir, "logo.png", makePng());
    const result = await (plugin.load as any)(file);
    expect(result).toMatch(/^export default "data:image\/png;base64,/);
  });

  it("inlines a JPEG", async () => {
    const file = await writeFixture(tmpDir, "photo.jpg", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]));
    const result = await (plugin.load as any)(file);
    expect(result).toMatch(/^export default "data:image\/jpeg;base64,/);
  });

  it("inlines an SVG", async () => {
    const file = await writeFixture(tmpDir, "icon.svg", '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');
    const result = await (plugin.load as any)(file);
    expect(result).toMatch(/^export default "data:image\/svg\+xml;base64,/);
  });

  it("inlines a WOFF2 font", async () => {
    const file = await writeFixture(tmpDir, "font.woff2", Buffer.from([0x77, 0x4f, 0x46, 0x32]));
    const result = await (plugin.load as any)(file);
    expect(result).toMatch(/^export default "data:font\/woff2;base64,/);
  });

  it("inlines a TTF font", async () => {
    const file = await writeFixture(tmpDir, "font.ttf", Buffer.from([0x00, 0x01, 0x00, 0x00]));
    const result = await (plugin.load as any)(file);
    expect(result).toMatch(/^export default "data:font\/ttf;base64,/);
  });

  it("ignores query strings in the id", async () => {
    const file = await writeFixture(tmpDir, "qlogo.png", makePng());
    const result = await (plugin.load as any)(file + "?v=123&inline");
    expect(result).toMatch(/^export default "data:image\/png;base64,/);
  });

  it("returns null for unknown extensions", async () => {
    const file = await writeFixture(tmpDir, "video.mp4", Buffer.from("mp4"));
    const result = await (plugin.load as any)(file);
    expect(result).toBeNull();
  });

  it("returns null for a missing file", async () => {
    const result = await (plugin.load as any)(path.join(tmpDir, "missing.png"));
    expect(result).toBeNull();
  });

  it("is case-insensitive for extensions", async () => {
    const file = await writeFixture(tmpDir, "UPPER.PNG", makePng());
    const result = await (plugin.load as any)(file);
    expect(result).toMatch(/^export default "data:image\/png;base64,/);
  });
});

// ---------------------------------------------------------------------------
// inlineCssAssets
// ---------------------------------------------------------------------------

describe("inlineCssAssets", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await makeTempDir();
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("inlines a relative url() reference", async () => {
    await writeFixture(tmpDir, "fonts/Inter.woff2", Buffer.from([0x77, 0x4f, 0x46, 0x32]));
    const css = `@font-face { font-family: Inter; src: url("./fonts/Inter.woff2"); }`;
    const out = await inlineCssAssets(css, tmpDir);
    expect(out).toContain('url("data:font/woff2;base64,');
    expect(out).not.toContain("./fonts/Inter.woff2");
  });

  it("inlines an absolute url()", async () => {
    await writeFixture(tmpDir, "logo.png", makePng());
    const css = `.banner { background: url("${tmpDir}/logo.png"); }`;
    const out = await inlineCssAssets(css, tmpDir);
    expect(out).toContain('url("data:image/png;base64,');
    expect(out).not.toContain(`${tmpDir}/logo.png`);
  });

  it("leaves data URIs untouched", async () => {
    const css = `.x { background: url("data:image/png;base64,abc"); }`;
    const out = await inlineCssAssets(css, tmpDir);
    expect(out).toContain("data:image/png;base64,abc");
  });

  it("leaves https URLs untouched", async () => {
    const css = `.x { background: url("https://cdn.example.com/x.png"); }`;
    const out = await inlineCssAssets(css, tmpDir);
    expect(out).toContain("https://cdn.example.com/x.png");
  });

  it("leaves http URLs untouched", async () => {
    const css = `.x { background: url("http://cdn.example.com/x.png"); }`;
    const out = await inlineCssAssets(css, tmpDir);
    expect(out).toContain("http://cdn.example.com/x.png");
  });

  it("leaves fragment identifiers untouched", async () => {
    const css = `.x { background: url("#gradient"); }`;
    const out = await inlineCssAssets(css, tmpDir);
    expect(out).toContain("#gradient");
  });

  it("leaves protocol-relative URLs untouched", async () => {
    const css = `.x { background: url("//cdn.example.com/x.png"); }`;
    const out = await inlineCssAssets(css, tmpDir);
    expect(out).toContain("//cdn.example.com/x.png");
  });

  it("leaves the original url() when the file is missing", async () => {
    const css = `.x { background: url("./missing.png"); }`;
    const out = await inlineCssAssets(css, tmpDir);
    expect(out).toContain("./missing.png");
  });

  it("replaces multiple url() references in one pass", async () => {
    await writeFixture(tmpDir, "a.png", makePng());
    await writeFixture(tmpDir, "b.svg", "<svg></svg>");
    const css = `.a { background: url("./a.png"); } .b { background: url("./b.svg"); }`;
    const out = await inlineCssAssets(css, tmpDir);
    expect(out).toContain("data:image/png;base64,");
    expect(out).toContain("data:image/svg+xml;base64,");
    expect(out).not.toContain("./a.png");
    expect(out).not.toContain("./b.svg");
  });

  it("handles unquoted urls", async () => {
    await writeFixture(tmpDir, "unquoted.png", makePng());
    const css = `.x { background: url(./unquoted.png); }`;
    const out = await inlineCssAssets(css, tmpDir);
    expect(out).toContain('url("data:image/png;base64,');
    expect(out).not.toContain("./unquoted.png");
  });

  it("handles single-quoted urls", async () => {
    await writeFixture(tmpDir, "single.png", makePng());
    const css = `.x { background: url('./single.png'); }`;
    const out = await inlineCssAssets(css, tmpDir);
    expect(out).toContain('url("data:image/png;base64,');
    expect(out).not.toContain("./single.png");
  });

  it("falls back to application/octet-stream for unknown extensions", async () => {
    await writeFixture(tmpDir, "data.bin", Buffer.from("hello"));
    const css = `.x { background: url("./data.bin"); }`;
    const out = await inlineCssAssets(css, tmpDir);
    expect(out).toContain("data:application/octet-stream;base64,");
  });
});

// ---------------------------------------------------------------------------
// inlineHtmlAssets
// ---------------------------------------------------------------------------

describe("inlineHtmlAssets", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await makeTempDir();
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("inlines <img src> from /assets/", async () => {
    await writeFixture(tmpDir, "logo.png", makePng());
    const html = `<img src="/assets/logo.png" alt="logo">`;
    const out = await inlineHtmlAssets(html, tmpDir);
    expect(out).toContain('src="data:image/png;base64,');
    expect(out).not.toContain("/assets/logo.png");
  });

  it("inlines <image href>", async () => {
    await writeFixture(tmpDir, "icon.svg", "<svg></svg>");
    const html = `<image href="/assets/icon.svg" width="24" height="24">`;
    const out = await inlineHtmlAssets(html, tmpDir);
    expect(out).toContain('href="data:image/svg+xml;base64,');
    expect(out).not.toContain("/assets/icon.svg");
  });

  it("inlines <use href>", async () => {
    await writeFixture(tmpDir, "sprite.svg", '<svg><symbol id="a"></symbol></svg>');
    const html = `<use href="/assets/sprite.svg#a"></use>`;
    const out = await inlineHtmlAssets(html, tmpDir);
    expect(out).toContain('href="data:image/svg+xml;base64,');
    expect(out).not.toContain("/assets/sprite.svg");
  });

  it("inlines <source src>", async () => {
    await writeFixture(tmpDir, "track.mp3", Buffer.from("mp3"));
    const html = `<source src="/assets/track.mp3" type="audio/mpeg">`;
    const out = await inlineHtmlAssets(html, tmpDir);
    expect(out).toContain('src="data:application/octet-stream;base64,');
    expect(out).not.toContain("/assets/track.mp3");
  });

  it("inlines <link href> for images", async () => {
    await writeFixture(tmpDir, "favicon.png", makePng());
    const html = `<link rel="icon" href="/assets/favicon.png">`;
    const out = await inlineHtmlAssets(html, tmpDir);
    expect(out).toContain('href="data:image/png;base64,');
    expect(out).not.toContain("/assets/favicon.png");
  });

  it("handles /@fs/ absolute paths", async () => {
    await writeFixture(tmpDir, "fslogo.png", makePng());
    const html = `<img src="/@fs/${tmpDir.replace(/\\/g, "/")}/fslogo.png">`;
    const out = await inlineHtmlAssets(html, tmpDir);
    expect(out).toContain('src="data:image/png;base64,');
    expect(out).not.toContain("/@fs/");
  });

  it("handles relative paths", async () => {
    await writeFixture(tmpDir, "img/photo.jpg", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]));
    const html = `<img src="./img/photo.jpg">`;
    const out = await inlineHtmlAssets(html, tmpDir);
    expect(out).toContain('src="data:image/jpeg;base64,');
    expect(out).not.toContain("./img/photo.jpg");
  });

  it("leaves data URIs untouched", async () => {
    const html = `<img src="data:image/png;base64,abc" alt="inline">`;
    const out = await inlineHtmlAssets(html, tmpDir);
    expect(out).toContain("data:image/png;base64,abc");
  });

  it("leaves https URLs untouched", async () => {
    const html = `<img src="https://cdn.example.com/x.png">`;
    const out = await inlineHtmlAssets(html, tmpDir);
    expect(out).toContain("https://cdn.example.com/x.png");
  });

  it("leaves protocol-relative URLs untouched", async () => {
    const html = `<img src="//cdn.example.com/x.png">`;
    const out = await inlineHtmlAssets(html, tmpDir);
    expect(out).toContain("//cdn.example.com/x.png");
  });

  it("leaves fragment identifiers untouched", async () => {
    const html = `<img src="#icon">`;
    const out = await inlineHtmlAssets(html, tmpDir);
    expect(out).toContain("#icon");
  });

  it("leaves the original attribute when the file is missing", async () => {
    const html = `<img src="/assets/missing.png">`;
    const out = await inlineHtmlAssets(html, tmpDir);
    expect(out).toContain("/assets/missing.png");
  });

  it("inlines url() inside inline <style> blocks", async () => {
    await writeFixture(tmpDir, "bg.png", makePng());
    const html = `<style>.hero { background: url("./bg.png"); }</style>`;
    const out = await inlineHtmlAssets(html, tmpDir);
    expect(out).toContain('url("data:image/png;base64,');
    expect(out).not.toContain('url("./bg.png")');
  });

  it("processes multiple <img> tags and inline styles concurrently", async () => {
    await writeFixture(tmpDir, "a.png", makePng());
    await writeFixture(tmpDir, "b.svg", "<svg></svg>");
    await writeFixture(tmpDir, "font.woff2", Buffer.from([0x77, 0x4f, 0x46, 0x32]));
    const html = `
      <img src="/assets/a.png">
      <image href="/assets/b.svg"></image>
      <style>@font-face { src: url("./font.woff2"); }</style>
    `;
    const out = await inlineHtmlAssets(html, tmpDir);
    expect(out).toContain("data:image/png;base64,");
    expect(out).toContain("data:image/svg+xml;base64,");
    expect(out).toContain("data:font/woff2;base64,");
    expect(out).not.toContain("/assets/a.png");
    expect(out).not.toContain("/assets/b.svg");
    expect(out).not.toContain("./font.woff2");
  });

  it("is a no-op when HTML has no asset references", async () => {
    const html = `<div>Hello</div>`;
    const out = await inlineHtmlAssets(html, tmpDir);
    expect(out).toBe(html);
  });
});
