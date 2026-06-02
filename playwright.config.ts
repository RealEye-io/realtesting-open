import { defineConfig } from "@playwright/test";

const reuseExistingServer = !process.env.CI;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  webServer: [
    {
      command: "npm run dev:face",
      url: "http://localhost:4173",
      reuseExistingServer,
      env: {
        VITE_MEDIAPIPE_WASM_BASE: "/mediapipe",
        VITE_MEDIAPIPE_MODEL_URL: "/models/blaze_face_short_range.tflite",
      },
    },
    {
      command: "npm run dev:proxy",
      url: "http://localhost:4174",
      reuseExistingServer,
    },
    {
      command: "npm run dev:screen",
      url: "http://localhost:4175",
      reuseExistingServer,
    },
    {
      command: "npm run dev:features",
      url: "http://localhost:4176",
      reuseExistingServer,
    },
    {
      command: "npm run dev:webrtc",
      url: "http://localhost:4177",
      reuseExistingServer,
    },
    {
      command: "npm run dev:websocket",
      url: "http://localhost:4178",
      reuseExistingServer,
    },
  ],
  use: {
    headless: true,
    browserName: "chromium",
  },
  projects: [
    {
      name: "screen-capture",
      use: {
        baseURL: "http://localhost:4175",
      },
      testMatch: [
        "**/screen-capture-demo.spec.ts",
        "**/screen-capture-*.spec.ts",
        "**/et-platform-compat.spec.ts",
      ],
    },
    {
      name: "browser-features",
      use: {
        baseURL: "http://localhost:4176",
      },
      testMatch: ["**/browser-features-demo.spec.ts"],
    },
    {
      name: "realcamera-face-demo",
      use: {
        baseURL: "http://localhost:4173",
      },
      testMatch: ["**/camera/face/**/*.spec.ts"],
    },
    {
      name: "realcamera-proxy-demo",
      use: {
        baseURL: "http://localhost:4174",
      },
      testMatch: ["**/camera/proxy/**/*.spec.ts"],
    },
    {
      name: "webrtc-demo",
      use: {
        baseURL: "http://localhost:4177",
      },
      testMatch: ["**/webrtc-demo.spec.ts"],
    },
    {
      name: "websocket-demo",
      use: {
        baseURL: "http://localhost:4178",
      },
      testMatch: ["**/websocket-demo.spec.ts"],
    },
  ],
});
