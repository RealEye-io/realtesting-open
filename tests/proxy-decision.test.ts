import { describe, it, expect } from "vitest";
import { decideCaptureImplementation } from "../packages/screen_capture/src/core/MediaDevicesDisplayMediaProxy";

describe("decideCaptureImplementation", () => {
  it("forces virtual when captureMode=virtual", () => {
    const decision = decideCaptureImplementation({
      captureMode: "virtual",
      virtualAvailable: true,
      virtualAllowed: true,
      nativeAvailable: true,
      blockNativeDisplayMedia: false,
    });
    expect(decision).toEqual({ implementation: "virtual", reason: "virtual-required" });
  });

  it("errors when native is blocked in captureMode=native", () => {
    const decision = decideCaptureImplementation({
      captureMode: "native",
      virtualAvailable: true,
      virtualAllowed: true,
      nativeAvailable: true,
      blockNativeDisplayMedia: true,
    });
    expect(decision.implementation).toBe("error");
  });

  it("prefers native when available in prefer-native mode", () => {
    const decision = decideCaptureImplementation({
      captureMode: "prefer-native",
      virtualAvailable: true,
      virtualAllowed: true,
      nativeAvailable: true,
      blockNativeDisplayMedia: false,
    });
    expect(decision).toEqual({ implementation: "native", reason: "prefer-native-native" });
  });

  it("falls back to virtual when native is blocked and virtual is usable", () => {
    const decision = decideCaptureImplementation({
      captureMode: "prefer-native",
      virtualAvailable: true,
      virtualAllowed: true,
      nativeAvailable: true,
      blockNativeDisplayMedia: true,
    });
    expect(decision).toEqual({
      implementation: "virtual",
      reason: "prefer-native-fallback-virtual-native-blocked",
    });
  });
});

