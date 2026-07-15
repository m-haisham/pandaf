import type { ViteDevServer } from "vite";
import { createSSRApp } from "vue";
import { renderToString } from "@vue/server-renderer";

// Dev renderer: vite.ssrLoadModule per request (no build step, per §3.4).
export async function renderDev(
  vite: ViteDevServer,
  template: string,
  data: unknown,
): Promise<string> {
  const mod = await vite.ssrLoadModule(`/src/templates/${template}.vue`);
  const component = (mod as { default: never }).default;
  const app = createSSRApp(component, data as Record<string, unknown>);
  return await renderToString(app);
}
