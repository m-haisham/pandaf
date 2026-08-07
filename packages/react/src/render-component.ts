import { createElement } from "react";
import { renderToString } from "react-dom/server";

type TemplateProps = Record<string, unknown>;

// Both dev (Vite ssrLoadModule) and prod (dynamic import) paths funnel through
// here so dev and prod produce byte-identical HTML for the same input.
export type TemplateModule = {
  Body?: React.ComponentType<TemplateProps>;
  Header?: React.ComponentType<TemplateProps>;
  Footer?: React.ComponentType<TemplateProps>;
  default?: React.ComponentType<TemplateProps>;
};

export async function renderComponent(
  mod: unknown,
  data: unknown,
): Promise<string> {
  const m = mod as TemplateModule;

  const Component = m.Body ?? m.default;
  if (!Component) {
    throw new Error(
      "React template must export a Body component (named export) or a default export.",
    );
  }

  return renderToString(createElement(Component, (data ?? {}) as TemplateProps));
}

export async function renderNamedComponent(
  mod: unknown,
  exportName: string,
  data: unknown,
): Promise<string> {
  const m = mod as TemplateModule;
  const Component = m[exportName as keyof TemplateModule];
  if (!Component) return "";
  return renderToString(createElement(Component, (data ?? {}) as TemplateProps));
}
