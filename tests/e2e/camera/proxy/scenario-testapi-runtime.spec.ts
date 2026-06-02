import { test, expect } from "../../fixtures/test";

test("test API controls permissions and injected errors", async ({ page }) => {
  await page.goto("/?realcameraTest=1&devtools=1");
  await page.waitForFunction(() => (window as any).__realcameraTestApi);
  await page.waitForFunction(
    () => (window as any).__realcameraTestApi.listVirtualDevices().length > 0
  );

  const deviceId = await page.evaluate(() => {
    const api = (window as any).__realcameraTestApi;
    return api.listVirtualDevices()[0]?.id ?? null;
  });
  expect(deviceId).toBeTruthy();

  const deniedName = await page.evaluate(async (id: string) => {
    const api = (window as any).__realcameraTestApi;
    api.setVirtualPermission("deny");
    try {
      await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: id } },
        audio: false,
      });
      return "allowed";
    } catch (error) {
      return error && typeof error === "object" && "name" in error
        ? String((error as { name?: string }).name)
        : "unknown";
    }
  }, deviceId as string);
  expect(deniedName).toBe("NotAllowedError");

  const injectedName = await page.evaluate(async (id: string) => {
    const api = (window as any).__realcameraTestApi;
    api.setVirtualPermission("allow");
    api.setNextGetUserMediaError({
      name: "NotReadableError",
      message: "Camera busy",
    });
    try {
      await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: id } },
        audio: false,
      });
      return "allowed";
    } catch (error) {
      return error && typeof error === "object" && "name" in error
        ? String((error as { name?: string }).name)
        : "unknown";
    }
  }, deviceId as string);
  expect(injectedName).toBe("NotReadableError");

  const physicalBlockedName = await page.evaluate(async () => {
    const api = (window as any).__realcameraTestApi;
    api.setPhysicalDevicesEnabled(false);
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      return "allowed";
    } catch (error) {
      return error && typeof error === "object" && "name" in error
        ? String((error as { name?: string }).name)
        : "unknown";
    }
  });
  // When physical devices are blocked and at least one virtual camera exists,
  // RealCamera should auto-select a virtual device for `{ video: true }` calls.
  expect(physicalBlockedName).toBe("allowed");

  const physicalBlockedNoVirtualName = await page.evaluate(async () => {
    const api = (window as any).__realcameraTestApi;
    api.setPhysicalDevicesEnabled(false);
    const devices = api.listVirtualDevices();
    devices.forEach((device: any) => api.setVirtualEnabled(device.id, false));
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      return "allowed";
    } catch (error) {
      return error && typeof error === "object" && "name" in error
        ? String((error as { name?: string }).name)
        : "unknown";
    }
  });
  expect(physicalBlockedNoVirtualName).toBe("NotAllowedError");
});

test("test API sets device source and waits for frames", async ({ page }) => {
  await page.goto("/?realcameraTest=1&devtools=1");
  await page.waitForFunction(() => (window as any).__realcameraTestApi);
  await page.waitForFunction(
    () => (window as any).__realcameraTestApi.listVirtualDevices().length > 0
  );
  await page.waitForFunction(() => {
    const select = document.querySelector<HTMLSelectElement>("#deviceSelect");
    return select && select.options.length > 0;
  });

  const deviceId = await page.evaluate(() => {
    const api = (window as any).__realcameraTestApi;
    return api.listVirtualDevices()[0]?.id ?? null;
  });
  expect(deviceId).toBeTruthy();

  await page.evaluate(async (id: string) => {
    const api = (window as any).__realcameraTestApi;
    await api.setVirtualSourceForDevice(id, { type: "color", color: "#00ff00" });
  }, deviceId as string);

  await page.selectOption("#deviceSelect", deviceId as string);
  await page.getByRole("button", { name: "Start Stream" }).click();
  await page.waitForFunction(() => {
    const video = document.querySelector<HTMLVideoElement>("#preview");
    return video && video.readyState >= 2 && video.videoWidth > 0;
  });

  await page.evaluate(async (id: string) => {
    const api = (window as any).__realcameraTestApi;
    await api.waitForFrames(2, id);
  }, deviceId as string);

  await page.waitForFunction(() => {
    const video = document.querySelector<HTMLVideoElement>("#preview");
    if (!video || video.videoWidth === 0) {
      return false;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return false;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
    return data[1] > 180 && data[0] < 80 && data[2] < 80;
  });
});

test("test API configure/reset reports state", async ({ page }) => {
  await page.goto("/?realcameraTest=1&devtools=1");
  await page.waitForFunction(() => (window as any).__realcameraTestApi);
  await page.waitForFunction(
    () => (window as any).__realcameraTestApi.listVirtualDevices().length > 0
  );

  const state = await page.evaluate(async () => {
    const api = (window as any).__realcameraTestApi;
    await api.configure({
      virtualPermission: "deny",
      blockPhysicalDevices: true,
      virtualSourceOverride: { type: "color", color: "#ff00ff" },
    });
    const configured = api.getState();
    api.reset();
    const reset = api.getState();
    return { configured, reset };
  });

  expect(state.configured.config?.virtualPermission).toBe("deny");
  expect(state.configured.config?.blockPhysicalDevices).toBe(true);
  expect(state.reset.config).toBeNull();
});
