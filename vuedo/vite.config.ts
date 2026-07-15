import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { viteSingleFile } from "vite-plugin-singlefile";

// SSR build for the orchestrator renderer (bundled into dist/entry-server.js),
// plus a client build that inlines all assets as Base64 data URIs (per §3.3).
export default defineConfig({
  plugins: [vue(), viteSingleFile()],
  build: {
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
