import { describe, it, expect } from "vitest";
import { resolveDisplayConstraints } from "../packages/screen_capture/src/utils/constraints";

describe("resolveDisplayConstraints", () => {
  it("uses defaults when no constraints are provided", () => {
    const resolved = resolveDisplayConstraints(undefined, { width: 800, height: 600, frameRate: 10 });
    expect(resolved).toEqual({ width: 800, height: 600, frameRate: 10 });
  });

  it("prefers exact values", () => {
    const resolved = resolveDisplayConstraints(
      {
        width: { exact: 640 },
        height: { exact: 480 },
        frameRate: { exact: 24 },
      } as MediaTrackConstraints,
      { width: 1280, height: 720, frameRate: 30 }
    );
    expect(resolved).toEqual({ width: 640, height: 480, frameRate: 24 });
  });

  it("falls back to ideal values", () => {
    const resolved = resolveDisplayConstraints(
      {
        width: { ideal: 1024 },
        height: { ideal: 768 },
        frameRate: { ideal: 60 },
      } as MediaTrackConstraints,
      { width: 1280, height: 720, frameRate: 30 }
    );
    expect(resolved).toEqual({ width: 1024, height: 768, frameRate: 60 });
  });

  it("sanitizes invalid values to defaults", () => {
    const resolved = resolveDisplayConstraints(
      {
        width: -1,
        height: 0,
        frameRate: Number.NaN,
      } as unknown as MediaTrackConstraints,
      { width: 1280, height: 720, frameRate: 30 }
    );
    expect(resolved).toEqual({ width: 1280, height: 720, frameRate: 30 });
  });

  it("clamps defaults down to max bounds when only max is provided", () => {
    const resolved = resolveDisplayConstraints(
      {
        width: { max: 800 },
        height: { max: 600 },
        frameRate: { max: 10 },
      } as unknown as MediaTrackConstraints,
      { width: 1280, height: 720, frameRate: 30 }
    );
    expect(resolved).toEqual({ width: 800, height: 600, frameRate: 10 });
  });

  it("clamps defaults up to min bounds when only min is provided", () => {
    const resolved = resolveDisplayConstraints(
      {
        width: { min: 1400 },
        height: { min: 900 },
        frameRate: { min: 60 },
      } as unknown as MediaTrackConstraints,
      { width: 1280, height: 720, frameRate: 30 }
    );
    expect(resolved).toEqual({ width: 1400, height: 900, frameRate: 60 });
  });
});
