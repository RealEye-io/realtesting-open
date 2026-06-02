import { test, expect } from "../../fixtures/test";

test("virtual camera permission prompt blocks until user responds", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__REALCAMERA_TEST_CONFIG__ = {
      enabled: true,
      virtualPermission: "prompt",
      permissionPromptMode: "manual",
      permissionPromptTimeoutMs: 0,
      // Keep everything virtual/deterministic for CI.
      blockPhysicalDevices: true,
    };
  });

  await page.goto("/?realcameraTest=1&devtools=1");
  await page.waitForFunction(() => (window as any).__realcameraTestApi);

  // Kick off getUserMedia WITHOUT awaiting it (so we can prove it blocks).
  await page.evaluate(() => {
    (window as any).__permTest = { resolved: false, error: null as null | string };
  });

  await page.evaluate(async () => {
    const api = (window as any).__realcameraTestApi;
    const devices = api.listVirtualDevices();
    const id = devices[0]?.id;
    if (!id) {
      throw new Error("No virtual devices available");
    }

    navigator.mediaDevices
      .getUserMedia({ video: { deviceId: { exact: id } }, audio: false })
      .then((stream) => {
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        (window as any).__permTest.resolved = true;
      })
      .catch((error) => {
        (window as any).__permTest.error = String(
          (error && (error.name || error.message)) || error
        );
      });
  });

  const request = await page.evaluate(async () => {
    const api = (window as any).__realcameraTestApi;
    return await api.waitForPermissionRequest();
  });

  expect(request?.id).toBeTruthy();
  expect(request?.deviceId).toBeTruthy();

  // Still blocked.
  expect(await page.evaluate(() => (window as any).__permTest.resolved)).toBe(false);

  // Simulate user clicking "Allow" after a small delay.
  await page.evaluate(async (id: string) => {
    const api = (window as any).__realcameraTestApi;
    await api.respondToPermissionRequest(id, true, { afterMs: 250 });
  }, request.id);

  await page.waitForFunction(() => (window as any).__permTest.resolved === true);

  const error = await page.evaluate(() => (window as any).__permTest.error);
  expect(error).toBeNull();
});
