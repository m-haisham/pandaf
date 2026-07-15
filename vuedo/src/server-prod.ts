import { buildApp } from "./server/index";
import { renderProd } from "./server/render.prod";

// Production entrypoint: thin wrapper that wires the static prod renderer.
// Compiled to dist-server/index.js via `pnpm build` (per §4.5 / §5).
buildApp({ render: renderProd }).listen(8080, () => {
  console.log("🦊 Origami PDF Service running (prod, static dist/) on :8080");
});
