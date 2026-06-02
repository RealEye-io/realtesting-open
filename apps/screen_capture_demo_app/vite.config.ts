import { defineConfig } from "vite";
import path from "node:path";

const root = __dirname;

export default defineConfig({
  root,
  publicDir: path.resolve(root, "public"),
  resolve: {
    alias: {
      "@realeye/realtesting-screen-capture": path.resolve(
        root,
        "../../packages/screen_capture/src"
      ),
    },
  },
  server: {
    port: 4175,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(root, "../../dist/screen_capture_demo_app"),
    emptyOutDir: true,
  },
});

