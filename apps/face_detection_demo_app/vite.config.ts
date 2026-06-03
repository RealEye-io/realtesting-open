import { defineConfig } from "vite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = __dirname;
const mediapipeVersion = process.env.REALCAMERA_MEDIAPIPE_VERSION ?? "0.10.32";
const mediapipeCacheRoot =
  process.env.REALCAMERA_MEDIAPIPE_CACHE_DIR ??
  path.join(os.homedir(), ".cache", "realcamera", "mediapipe", mediapipeVersion);
const mediapipeWasmDir = path.join(mediapipeCacheRoot, "wasm");
const mediapipeModelDir = path.join(mediapipeCacheRoot, "models");

function serveCachedAssets(prefix: string, dir: string) {
  const normalizedDir = path.resolve(dir);
  return {
    name: `realcamera-cache-${prefix}`,
    configureServer(server: { middlewares: { use: Function } }) {
      server.middlewares.use(prefix, (req: { url?: string }, res: any, next: Function) => {
        if (!req.url) {
          next();
          return;
        }
        const urlPath = decodeURIComponent(req.url.split("?")[0] ?? "");
        const relPath = urlPath.replace(/^\/+/, "");
        const filePath = path.resolve(normalizedDir, relPath);
        if (!filePath.startsWith(normalizedDir + path.sep) && filePath !== normalizedDir) {
          next();
          return;
        }
        fs.stat(filePath, (err, stats) => {
          if (err || !stats.isFile()) {
            next();
            return;
          }
          const ext = path.extname(filePath).toLowerCase();
          if (ext === ".wasm") {
            res.setHeader("Content-Type", "application/wasm");
          } else if (ext === ".js") {
            res.setHeader("Content-Type", "application/javascript");
          } else if (ext === ".tflite") {
            res.setHeader("Content-Type", "application/octet-stream");
          }
          fs.createReadStream(filePath).pipe(res);
        });
      });
    },
  };
}

export default defineConfig({
  root,
  publicDir: path.resolve(root, "public"),
  plugins: [
    serveCachedAssets("/mediapipe", mediapipeWasmDir),
    serveCachedAssets("/models", mediapipeModelDir),
  ],
  resolve: {
    alias: {
      "@realeye-io/realcamera": path.resolve(
        root,
        "../../packages/realcamera/src"
      ),
    },
  },
  server: {
    port: 4173,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(root, "../../dist/face_detection_demo_app"),
    emptyOutDir: true,
  },
});
