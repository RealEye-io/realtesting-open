import { describe, it, expect } from "vitest";
import {
  applyVideoConstraintsOverride,
  extractDeviceId,
  resolveVideoConstraints,
} from "../../packages/realcamera/src/utils/constraints";

describe("constraints helpers", () => {
  it("resolves video constraints with defaults", () => {
    const resolved = resolveVideoConstraints({ width: 1280, height: 720, frameRate: 15 });
    expect(resolved.width).toBe(1280);
    expect(resolved.height).toBe(720);
    expect(resolved.frameRate).toBe(15);
  });

  it("extracts deviceId from constraints", () => {
    const id = extractDeviceId({ deviceId: { exact: "virtual-1" } });
    expect(id).toBe("virtual-1");
  });

  it("applies virtual video overrides on top of requested constraints", () => {
    const merged = applyVideoConstraintsOverride(
      {
        deviceId: { exact: "virtual-1" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 60 },
      },
      {
        width: { exact: 640 },
        height: { exact: 480 },
        frameRate: { exact: 30 },
      }
    ) as MediaTrackConstraints;

    expect(merged.deviceId).toEqual({ exact: "virtual-1" });
    expect(merged.width).toEqual({ exact: 640 });
    expect(merged.height).toEqual({ exact: 480 });
    expect(merged.frameRate).toEqual({ exact: 30 });
  });

  it("creates constraints from override when the app requested boolean video", () => {
    const merged = applyVideoConstraintsOverride(true, {
      width: { exact: 640 },
      height: { exact: 480 },
      frameRate: { exact: 30 },
    }) as MediaTrackConstraints;

    expect(merged).toEqual({
      width: { exact: 640 },
      height: { exact: 480 },
      frameRate: { exact: 30 },
    });
  });
});
