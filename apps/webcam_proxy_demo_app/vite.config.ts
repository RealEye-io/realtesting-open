import { defineConfig } from "vite";
import path from "node:path";

const root = __dirname;

export default defineConfig({
  root,
  publicDir: path.resolve(root, "public"),
  resolve: {
    alias: {
      "@realeye-io/realtesting-camera": path.resolve(
        root,
        "../../packages/camera/src"
      ),
    },
  },
  server: {
    port: 4174,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(root, "../../dist/webcam_proxy_demo_app"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(root, "index.html"),
        devtools: path.resolve(root, "devtools.html"),
      },
    },
  },
});
