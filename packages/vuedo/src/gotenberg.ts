export interface GotenbergInput {
  body: string;
  header?: string;
  footer?: string;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
}

// Minimal Gotenberg HTTP client: posts the (already asset-inlined) HTML plus
// optional header/footer documents to the Chromium HTML route and streams the
// resulting PDF bytes straight back to the caller.
export async function sendToGotenberg(
  baseUrl: string,
  input: GotenbergInput,
): Promise<ReadableStream> {
  const form = new FormData();
  form.append(
    "files",
    new Blob([input.body], { type: "text/html" }),
    "index.html",
  );
  if (input.header) {
    form.append(
      "files",
      new Blob([input.header], { type: "text/html" }),
      "header.html",
    );
  }
  if (input.footer) {
    form.append(
      "files",
      new Blob([input.footer], { type: "text/html" }),
      "footer.html",
    );
  }
  form.append("marginTop", String(input.marginTop ?? 0.4));
  form.append("marginBottom", String(input.marginBottom ?? 0.4));
  if (input.marginLeft !== undefined)
    form.append("marginLeft", String(input.marginLeft));
  if (input.marginRight !== undefined)
    form.append("marginRight", String(input.marginRight));

  const res = await fetch(`${baseUrl}/forms/chromium/convert/html`, {
    method: "POST",
    body: form,
  });

  if (!res.ok || !res.body) {
    throw new Error(`Gotenberg conversion failed (${res.status})`);
  }
  return res.body;
}
