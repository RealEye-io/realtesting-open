import { defineConfig } from "vite";
import path from "node:path";

const root = __dirname;

export default defineConfig({
  root,
  publicDir: path.resolve(root, "public"),
  resolve: {
    alias: {
      "@realeye-io/realtesting-browser-features": path.resolve(
        root,
        "../../packages/browser_features/src"
      ),
    },
  },
  server: {
    port: 4176,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(root, "../../dist/browser_features_demo_app"),
    emptyOutDir: true,
  },
});

