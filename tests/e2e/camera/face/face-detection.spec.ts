import { test, expect } from "../../fixtures/test";

test("virtual camera produces detectable face", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__realcameraFaceDemo?.ready === true);

  const data = await page.evaluate(() => window.__realcameraFaceDemo);
  expect(data?.error).toBeFalsy();
  expect(data?.deviceId).toBeTruthy();
  expect(Array.isArray(data?.detections)).toBe(true);
  expect(data?.detections?.length).toBeGreaterThan(0);

  const statusText = await page.textContent("#status");
  expect(statusText ?? "").toContain("Detection complete");

  const detection = data?.detections?.[0];
  expect(detection?.score ?? 0).toBeGreaterThan(0.4);
  expect(detection?.boundingBox?.width ?? 0).toBeGreaterThan(50);
  expect(detection?.boundingBox?.height ?? 0).toBeGreaterThan(50);

  const deviceIds = (data?.devices ?? []).map((device) => device.deviceId);
  expect(deviceIds).toContain(data?.deviceId);

  expect(data?.settings?.width).toBe(640);
  expect(data?.settings?.height).toBe(480);
});
