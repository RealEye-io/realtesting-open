import { test, expect } from "../../fixtures/test";

test("supports multiple virtual devices and switching", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__realcameraFaceDemo?.ready === true);

  const data = await page.evaluate(() => window.__realcameraFaceDemo);
  expect(data?.altDeviceId).toBeTruthy();
  expect(data?.deviceId).not.toBe(data?.altDeviceId);
  expect(data?.altSettings?.width).toBe(320);
  expect(data?.altSettings?.height).toBe(240);
});
