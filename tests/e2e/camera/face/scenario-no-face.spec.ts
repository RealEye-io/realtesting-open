import { test, expect } from "../../fixtures/test";

test("no-face scenario yields no detections", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __REALCAMERA_TEST_CONFIG__?: unknown })
      .__REALCAMERA_TEST_CONFIG__ = {
      enabled: true,
      virtualSourceOverride: { type: "blank" },
    };
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__realcameraFaceDemo?.ready === true);

  const data = await page.evaluate(() => window.__realcameraFaceDemo);
  expect(data?.error).toBeFalsy();
  expect(Array.isArray(data?.detections)).toBe(true);
  expect(data?.detections?.length ?? 0).toBe(0);

  const statusText = await page.textContent("#status");
  expect(statusText ?? "").toContain("No faces detected");
});
