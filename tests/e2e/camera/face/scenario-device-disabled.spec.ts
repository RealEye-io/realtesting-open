import { test, expect } from "../../fixtures/test";

test("device disabled scenario is surfaced", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __REALCAMERA_TEST_CONFIG__?: unknown })
      .__REALCAMERA_TEST_CONFIG__ = {
      enabled: true,
      nextVirtualDevice: { enabled: false },
    };
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__realcameraFaceDemo?.ready === true);

  const data = await page.evaluate(() => window.__realcameraFaceDemo);
  expect(data?.error).toBeTruthy();
  expect(data?.error ?? "").toContain("No matching device");
});
