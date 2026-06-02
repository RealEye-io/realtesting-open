import { test, expect } from "../../fixtures/test";

test("getUserMedia delay simulates slow permission flow", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__REALCAMERA_TEST_CONFIG__ = {
      enabled: true,
      getUserMediaDelayMs: 900,
    };
  });
  await page.goto("/?realcameraTest=1&devtools=1");
  await page.waitForFunction(() => (window as any).__realcameraTestApi);

  const duration = await page.evaluate(async () => {
    const api = (window as any).__realcameraTestApi;
    const devices = api.listVirtualDevices();
    const id = devices[0]?.id;
    const start = performance.now();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: id } },
      audio: false,
    });
    stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    return performance.now() - start;
  });

  expect(duration).toBeGreaterThan(800);
});
