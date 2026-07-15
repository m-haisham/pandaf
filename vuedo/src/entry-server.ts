import { createSSRApp } from "vue";
import { renderToString } from "@vue/server-renderer";
import Invoice from "./templates/Invoice.vue";

// Template registry — explicitly imported so they bundle into dist/ for prod.
const registry = {
  Invoice,
} as Record<string, unknown>;

export async function renderPdfBody(
  template: string,
  data: unknown,
): Promise<string> {
  const component = registry[template];
  if (!component) {
    throw new Error(`Unknown template: ${template}`);
  }
  const app = createSSRApp(component as never, data as Record<string, unknown>);
  return await renderToString(app);
}
