/** Body: the main page document. */
export function wrapBody(content: string, css = ""): string {
  const style = css ? `<style>${css}</style>` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${style}</head><body>${content}</body></html>`;
}

/**
 * Header: standalone Gotenberg header document.
 *
 * Neutralizes Chromium's default `padding-top: 15pt` on the `#header` box and
 * forces a base reset (border-box, 16px root font, print-color-adjust) so
 * Tailwind utilities compute correctly in the narrow header page-box.
 */
export function wrapHeader(content: string, css = ""): string {
  const reset = `
    <style>
      * {
        box-sizing: border-box !important;
        font-size: 16px !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      header {
        width: 100% !important;
      }
      #header {
        padding-top: 0 !important;
      }
    </style>`;
  const style = css ? `<style>${css}</style>` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${reset}${style}</head><body>${content}</body></html>`;
}

/**
 * Footer: standalone Gotenberg footer document.
 *
 * Mirrors `wrapHeader`'s tuning: neutralizes Chromium's default
 * `padding-bottom: 15pt` on the footer box, plus the same base reset.
 */
export function wrapFooter(content: string, css = ""): string {
  const reset = `
    <style>
      * {
        box-sizing: border-box !important;
        font-size: 16px !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      footer {
        width: 100% !important;
      }
      #footer {
        padding-bottom: 0 !important;
      }
    </style>`;
  const style = css ? `<style>${css}</style>` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${reset}${style}</head><body>${content}</body></html>`;
}
