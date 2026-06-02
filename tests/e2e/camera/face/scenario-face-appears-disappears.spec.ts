import { test, expect } from "../../fixtures/test";

test("face appears and disappears over time", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __REALCAMERA_TEST_CONFIG__?: unknown })
      .__REALCAMERA_TEST_CONFIG__ = {
      enabled: true,
      virtualSourceOverride: { type: "blank" },
    };
  });
  await page.goto("/?realcameraTest=1");
  await page.waitForFunction(() => window.__realcameraFaceDemo?.ready === true);

  await page.waitForFunction(
    () => document.querySelector("#status")?.textContent?.includes("No faces detected"),
    undefined,
    { timeout: 10_000 }
  );
  const beforeDetections = await page.evaluate(
    () => window.__realcameraFaceDemo?.detections?.length ?? 0
  );
  expect(beforeDetections).toBe(0);

  await page.evaluate(async () => {
    const api = (window as unknown as { __realcameraTestApi?: any })
      .__realcameraTestApi;
    if (!api) {
      throw new Error("RealCamera test API not available");
    }
    await api.setVirtualSourceOverride({ type: "image", url: "/fixtures/face.jpg" });
    await api.waitForFrames(2);
  });

  await page.waitForFunction(
    () =>
      (window.__realcameraFaceDemo?.detections?.length ?? 0) > 0 &&
      (document.querySelector("#status")?.textContent ?? "").includes(
        "Detection complete"
      ),
    undefined,
    { timeout: 10_000 }
  );

  await page.evaluate(async () => {
    const api = (window as unknown as { __realcameraTestApi?: any })
      .__realcameraTestApi;
    if (!api) {
      throw new Error("RealCamera test API not available");
    }
    await api.setVirtualSourceOverride({ type: "blank" });
    await api.waitForFrames(2);
  });

  await page.waitForFunction(
    () =>
      (window.__realcameraFaceDemo?.detections?.length ?? 0) === 0 &&
      (document.querySelector("#status")?.textContent ?? "").includes(
        "No faces detected"
      ),
    undefined,
    { timeout: 10_000 }
  );
});
