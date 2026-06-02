import { test, expect } from "./fixtures/test";
import type { Page } from "@playwright/test";

test("virtual getDisplayMedia works headlessly and supports runtime switching", async ({ page }) => {
  await page.goto("/?realtestingTest=1");

  await page.waitForFunction(() => (window as any).__realtestingTestApi);

  // Configure deterministic virtual capture.
  await page.evaluate(async () => {
    const api = (window as any).__realtestingTestApi;
    await api.configure({
      captureMode: "virtual",
      virtualPermission: "allow",
      blockNativeDisplayMedia: true,
      virtualSourceOverride: { type: "color", color: "#00ff00" },
    });
  });

  await page.getByRole("button", { name: "Start Capture" }).click();

  await page.waitForFunction(() => {
    const video = document.querySelector<HTMLVideoElement>("#preview");
    return Boolean(video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0);
  });

  const green = await sampleCenterPixel(page);
  expect(green.g, "expected green-ish pixel").toBeGreaterThan(180);
  expect(green.r, "expected low red channel").toBeLessThan(90);
  expect(green.b, "expected low blue channel").toBeLessThan(90);

  // Swap source at runtime.
  await page.evaluate(async () => {
    const api = (window as any).__realtestingTestApi;
    await api.setVirtualSourceOverride({ type: "color", color: "#ff0000" });
    await api.waitForFrames(2);
  });

  const red = await sampleCenterPixel(page);
  expect(red.r, "expected red-ish pixel").toBeGreaterThan(180);
  expect(red.g, "expected low green channel").toBeLessThan(90);
  expect(red.b, "expected low blue channel").toBeLessThan(90);

  // Stop and ensure native mode does not hang (blocked should fail fast).
  await page.getByRole("button", { name: "Stop Capture" }).click();

  await page.evaluate(() => {
    const api = (window as any).__realtestingTestApi;
    api.setCaptureMode("native");
    api.setBlockNativeDisplayMedia(true);
  });

  await page.getByRole("button", { name: "Start Capture" }).click();
  await expect(page.locator("#errorBox")).toContainText("NotAllowedError", { timeout: 5000 });

  // Return to virtual and ensure capture works again.
  await page.evaluate(async () => {
    const api = (window as any).__realtestingTestApi;
    api.setCaptureMode("virtual");
    api.setVirtualPermission("allow");
    api.setBlockNativeDisplayMedia(true);
    await api.setVirtualSourceOverride({ type: "color", color: "#00ff00" });
  });

  await page.getByRole("button", { name: "Start Capture" }).click();
  await page.waitForFunction(() => {
    const video = document.querySelector<HTMLVideoElement>("#preview");
    return Boolean(video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0);
  });

  const greenAgain = await sampleCenterPixel(page);
  expect(greenAgain.g).toBeGreaterThan(180);
});

async function sampleCenterPixel(page: Page): Promise<{ r: number; g: number; b: number; a: number }> {
  return page.evaluate(() => {
    const video = document.querySelector<HTMLVideoElement>("#preview");
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      throw new Error("Preview video is not ready");
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not get 2D context");
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const x = Math.floor(canvas.width / 2);
    const y = Math.floor(canvas.height / 2);
    const data = ctx.getImageData(x, y, 1, 1).data;
    return { r: data[0], g: data[1], b: data[2], a: data[3] };
  });
}
