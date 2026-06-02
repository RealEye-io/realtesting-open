import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const MEDIAPIPE_VERSION = process.env.REALCAMERA_MEDIAPIPE_VERSION ?? "0.10.32";
const CACHE_ROOT =
  process.env.REALCAMERA_MEDIAPIPE_CACHE_DIR ??
  path.join(os.homedir(), ".cache", "realcamera", "mediapipe", MEDIAPIPE_VERSION);
const WASM_DIR = path.join(CACHE_ROOT, "wasm");
const MODEL_DIR = path.join(CACHE_ROOT, "models");
const FORCE =
  process.argv.includes("--force") || process.env.REALCAMERA_MEDIAPIPE_FORCE === "1";

const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

const wasmFiles = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function fileExists(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.isFile() && stats.size > 0;
  } catch {
    return false;
  }
}

async function download(url, dest) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(arrayBuffer));
}

async function fetchIfMissing(url, dest) {
  if (!FORCE && fileExists(dest)) {
    return false;
  }
  await download(url, dest);
  return true;
}

async function run() {
  ensureDir(WASM_DIR);
  ensureDir(MODEL_DIR);

  let downloaded = 0;
  for (const file of wasmFiles) {
    const url = `${WASM_BASE}/${file}`;
    const dest = path.join(WASM_DIR, file);
    if (await fetchIfMissing(url, dest)) {
      downloaded += 1;
      console.log(`Downloaded ${file}`);
    }
  }

  const modelDest = path.join(MODEL_DIR, "blaze_face_short_range.tflite");
  if (await fetchIfMissing(MODEL_URL, modelDest)) {
    downloaded += 1;
    console.log("Downloaded blaze_face_short_range.tflite");
  }

  if (downloaded === 0) {
    console.log("MediaPipe assets already cached.");
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
