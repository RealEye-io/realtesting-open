import { test, expect } from "../../fixtures/test";

test("legacy getUserMedia APIs map to RealCamera virtual streams", async ({
  page,
}) => {
  await page.goto("/?realcameraTest=1");

  await page.waitForFunction(() => (window as any).__realcameraTestApi);

  await page.evaluate(() => {
    const api = (window as any).__realcameraTestApi;
    api.setPhysicalDevicesEnabled(false);
  });

  const legacy = await page.evaluate(() => {
    const callLegacy = (fn: any) =>
      new Promise<{ videoTracks: number; label: string | null }>(
        (resolve, reject) => {
          fn(
            { video: true },
            (stream: MediaStream) => {
              const tracks = stream.getVideoTracks();
              resolve({
                videoTracks: tracks.length,
                label: tracks[0]?.label ?? null,
              });
            },
            (error: any) => reject(error)
          );
        }
      );

    const getUserMedia = (navigator as any).getUserMedia;
    const webkitGetUserMedia = (navigator as any).webkitGetUserMedia;
    const mozGetUserMedia = (navigator as any).mozGetUserMedia;

    if (typeof getUserMedia !== "function") {
      throw new Error("navigator.getUserMedia is not a function");
    }
    if (typeof webkitGetUserMedia !== "function") {
      throw new Error("navigator.webkitGetUserMedia is not a function");
    }
    if (typeof mozGetUserMedia !== "function") {
      throw new Error("navigator.mozGetUserMedia is not a function");
    }

    return Promise.all([
      callLegacy(getUserMedia),
      callLegacy(webkitGetUserMedia),
      callLegacy(mozGetUserMedia),
    ]);
  });

  legacy.forEach((result) => {
    expect(result.videoTracks).toBeGreaterThan(0);
  });

  const modern = await page.evaluate(() => {
    return navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => ({
        videoTracks: stream.getVideoTracks().length,
      }));
  });
  expect(modern.videoTracks).toBeGreaterThan(0);
});

