import { test, expect } from "../../fixtures/test";

test("can toggle face appearance on the fly via test API", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __REALCAMERA_TEST_CONFIG__?: unknown })
      .__REALCAMERA_TEST_CONFIG__ = {
      enabled: true,
      virtualSourceOverride: { type: "color", color: "#ff00ff" },
    };
  });
  await page.goto("/?realcameraTest=1");
  await page.waitForFunction(() => window.__realcameraFaceDemo?.ready === true);

  const beforePixel = await page.evaluate(() => {
    const video = document.querySelector<HTMLVideoElement>("#virtualVideo");
    if (!video) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
    return [data[0], data[1], data[2]];
  });

  await page.evaluate(async () => {
    const api = (window as unknown as { __realcameraTestApi?: any })
      .__realcameraTestApi;
    if (!api) {
      throw new Error("RealCamera test API not available");
    }
    await api.setVirtualSourceOverride({
      type: "image",
      url: "/fixtures/face.jpg",
    });
    await api.waitForFrames(2);
  });

  const afterPixel = await page.evaluate(() => {
    const video = document.querySelector<HTMLVideoElement>("#virtualVideo");
    if (!video) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
    return [data[0], data[1], data[2]];
  });

  expect(beforePixel).not.toEqual(afterPixel);
});
