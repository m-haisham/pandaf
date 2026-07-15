import { Elysia, t } from "elysia";
import fs from "fs";
import path from "path";

type RenderFn = (template: string, data: unknown) => Promise<string>;

// Mode-agnostic app: receives a `render` fn via dependency injection so the
// same route/validation/orchestration logic works in dev and prod.
export function buildApp({ render }: { render: RenderFn }) {
  let compiledCss = "";
  const cssPath = path.resolve("./dist/assets/style.css");
  if (fs.existsSync(cssPath)) {
    compiledCss = fs.readFileSync(cssPath, "utf-8");
  }

  const wrapHtml = (content: string) => `
    <!DOCTYPE html>
    <html>
      <head><style>${compiledCss}</style></head>
      <body>${content}</body>
    </html>
  `;

  return new Elysia().post(
    "/api/v1/generate-pdf",
    async ({ body, query, set }) => {
      try {
        const rawVueHtml = await render(body.template, body.data);
        const bodyHtml = wrapHtml(rawVueHtml);
        const headerHtml = wrapHtml(`<div id="dynamic-header">...</div>`);

        // Dev convenience: ?preview=html returns the composed HTML directly
        // instead of round-tripping through Gotenberg, for quick sanity checks.
        if (query.preview === "html") {
          return new Response(bodyHtml, {
            headers: { "Content-Type": "text/html" },
          });
        }

        const form = new FormData();
        form.append(
          "files",
          new Blob([bodyHtml], { type: "text/html" }),
          "index.html",
        );
        form.append(
          "files",
          new Blob([headerHtml], { type: "text/html" }),
          "header.html",
        );
        form.append("marginTop", "1");
        form.append("marginBottom", "1");

        const gotenbergRes = await fetch(
          process.env.GOTENBERG_URL + "/forms/chromium/convert/html",
          {
            method: "POST",
            body: form,
          },
        );

        if (!gotenbergRes.ok)
          throw new Error("Gotenberg failed to generate PDF");

        return new Response(gotenbergRes.body, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${body.template}.pdf"`,
          },
        });
      } catch (error) {
        console.error(error);
        set.status = 500;
        return { error: "PDF Generation Failed" };
      }
    },
    {
      body: t.Object({
        template: t.String(),
        data: t.Any(),
      }),
      query: t.Object({
        preview: t.Optional(t.String()),
      }),
    },
  );
}
