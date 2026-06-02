import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "..");

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(projectRoot, relativePath));
}

describe("RealTesting scaffold", () => {
  it("includes required files", () => {
    expect(fileExists("README.md")).toBe(true);
    expect(fileExists("packages/screen_capture/src/index.ts")).toBe(true);
    expect(fileExists("packages/browser_features/src/index.ts")).toBe(true);
    expect(fileExists("packages/realcamera/src/index.ts")).toBe(true);
    expect(fileExists("packages/webrtc/src/index.ts")).toBe(true);
    expect(fileExists("packages/websocket/src/index.ts")).toBe(true);
    expect(fileExists("apps/browser_features_demo_app/src/main.ts")).toBe(true);
    expect(fileExists("apps/screen_capture_demo_app/src/main.ts")).toBe(true);
    expect(fileExists("apps/face_detection_demo_app/src/face-demo.ts")).toBe(true);
    expect(fileExists("apps/webcam_proxy_demo_app/src/proxy-demo.ts")).toBe(true);
    expect(fileExists("apps/webrtc_demo_app/src/main.ts")).toBe(true);
    expect(fileExists("apps/websocket_demo_app/src/main.ts")).toBe(true);
  });

  it("README.md contains project title", () => {
    const contents = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");
    expect(contents.includes("RealTesting")).toBe(true);
  });
});
