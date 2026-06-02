import { test, expect } from "../../fixtures/test";

test("permission denied scenario is surfaced", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __REALCAMERA_TEST_CONFIG__?: unknown })
      .__REALCAMERA_TEST_CONFIG__ = {
      enabled: true,
      nextGetUserMediaError: {
        name: "NotAllowedError",
        message: "Permission denied by test",
      },
    };
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__realcameraFaceDemo?.ready === true);

  const data = await page.evaluate(() => window.__realcameraFaceDemo);
  expect(data?.error).toBeTruthy();
  expect(data?.error ?? "").toContain("Permission denied");
});
