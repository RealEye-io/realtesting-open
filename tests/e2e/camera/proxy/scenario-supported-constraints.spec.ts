import { test, expect } from "../../fixtures/test";

test("supported constraints override is respected", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__REALCAMERA_TEST_CONFIG__ = {
      enabled: true,
      supportedConstraintsOverride: {
        width: false,
        height: false,
        frameRate: false,
      },
    };
  });
  await page.goto("/?realcameraTest=1&devtools=1");
  await page.waitForFunction(() => (window as any).__realcameraTestApi);

  const supported = await page.evaluate(() =>
    navigator.mediaDevices.getSupportedConstraints()
  );
  expect(supported).toEqual({
    width: false,
    height: false,
    frameRate: false,
  });
});
