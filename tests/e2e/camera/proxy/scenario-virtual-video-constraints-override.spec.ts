import { test, expect } from "../../fixtures/test";

test(
  "virtual video constraints override forces deterministic stream settings",
  async ({ page }: { page: any }) => {
    await page.addInitScript(() => {
      (window as any).__REALCAMERA_TEST_CONFIG__ = {
        enabled: true,
        virtualVideoConstraintsOverride: {
          width: { exact: 640 },
          height: { exact: 480 },
          frameRate: { exact: 30 },
        },
      };
    });

    await page.goto("/?realcameraTest=1&devtools=1");
    await page.waitForFunction(() => (window as any).__realcameraTestApi);

    const result = await page.evaluate(async () => {
      const api = (window as any).__realcameraTestApi;
      const deviceId = api.listVirtualDevices?.()[0]?.id;
      if (!deviceId) {
        throw new Error("No RealCamera virtual device is available");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 60, max: 60 },
        },
        audio: false,
      });

      const track = stream.getVideoTracks()[0];
      if (!track) {
        throw new Error("Virtual video track was not created");
      }

      const before = track.getSettings();

      await track.applyConstraints({
        width: { exact: 1280 },
        height: { exact: 720 },
        frameRate: { exact: 24 },
      });

      const after = track.getSettings();

      const video = document.createElement("video");
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        if (
          video.videoWidth > 0 &&
          video.videoHeight > 0 &&
          video.readyState >= 2
        ) {
          break;
        }
        await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
      }

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error("Timed out waiting for preview video dimensions");
      }

      const dimensions = {
        width: video.videoWidth,
        height: video.videoHeight,
      };

      stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
      video.srcObject = null;

      return {
        before: {
          width: before.width ?? null,
          height: before.height ?? null,
          frameRate: before.frameRate ?? null,
        },
        after: {
          width: after.width ?? null,
          height: after.height ?? null,
          frameRate: after.frameRate ?? null,
        },
        dimensions,
      };
    });

    expect(result.before).toEqual({
      width: 640,
      height: 480,
      frameRate: 30,
    });
    expect(result.after).toEqual({
      width: 640,
      height: 480,
      frameRate: 30,
    });
    expect(result.dimensions).toEqual({
      width: 640,
      height: 480,
    });
  },
);
