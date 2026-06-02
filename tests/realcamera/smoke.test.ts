import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "../..");

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(projectRoot, relativePath));
}

describe("RealCamera scaffold", () => {
  it("includes required files", () => {
    expect(fileExists("README.md")).toBe(true);
    expect(fileExists("packages/realcamera/src/index.ts")).toBe(true);
    expect(fileExists("apps/webcam_proxy_demo_app/index.html")).toBe(true);
    expect(fileExists("apps/face_detection_demo_app/index.html")).toBe(true);
  });

  it("RealCamera package metadata is present", () => {
    const pkg = fs.readFileSync(path.join(projectRoot, "packages/realcamera/package.json"), "utf8");
    expect(pkg).toContain('"name": "@realeye/realcamera"');
  });
});
