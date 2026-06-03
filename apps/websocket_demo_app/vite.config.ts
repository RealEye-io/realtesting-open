import { defineConfig } from "vite";
import path from "node:path";

const root = __dirname;

export default defineConfig({
  root,
  publicDir: path.resolve(root, "public"),
  resolve: {
    alias: {
      "@realeye-io/realtesting-websocket": path.resolve(
        root,
        "../../packages/websocket/src"
      ),
    },
  },
  server: {
    port: 4178,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(root, "../../dist/websocket_demo_app"),
    emptyOutDir: true,
  },
});

