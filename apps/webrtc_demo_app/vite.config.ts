import { defineConfig } from "vite";
import path from "node:path";

const root = __dirname;

export default defineConfig({
  root,
  publicDir: path.resolve(root, "public"),
  resolve: {
    alias: {
      "@realeye-io/realtesting-webrtc": path.resolve(root, "../../packages/webrtc/src"),
    },
  },
  server: {
    port: 4177,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(root, "../../dist/webrtc_demo_app"),
    emptyOutDir: true,
  },
});

