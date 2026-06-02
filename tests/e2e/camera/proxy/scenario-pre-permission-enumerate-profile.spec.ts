import { test, expect } from "../../fixtures/test";

test("pre-permission enumerate profile can mimic anonymous single-camera browser behavior", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__REALCAMERA_TEST_CONFIG__ = {
      enabled: true,
      virtualPermission: "prompt",
      permissionPromptMode: "manual",
      permissionPromptTimeoutMs: 0,
      blockPhysicalDevices: true,
      prePermissionEnumerateProfile: "single-anonymous",
    };
  });

  await page.goto("/?realcameraTest=1&devtools=1");
  await page.waitForFunction(() => (window as any).__realcameraTestApi);

  const beforePermission = await page.evaluate(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === "videoinput")
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label,
        groupId: device.groupId,
      }));
  });

  expect(beforePermission).toEqual([
    {
      deviceId: expect.any(String),
      label: "",
      groupId: expect.any(String),
    },
  ]);
  expect(beforePermission[0]?.deviceId?.length ?? 0).toBeGreaterThan(0);
  expect(beforePermission[0]?.groupId?.length ?? 0).toBeGreaterThan(0);

  await page.evaluate(async () => {
    const api = (window as any).__realcameraTestApi;
    const deviceId = api.listVirtualDevices?.()[0]?.id;
    if (!deviceId) {
      throw new Error("No virtual camera available");
    }

    (window as any).__realcameraEnumerateProfileTest = {
      resolved: false,
      error: null as null | string,
    };

    navigator.mediaDevices
      .getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false,
      })
      .then((stream) => {
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        (window as any).__realcameraEnumerateProfileTest.resolved = true;
      })
      .catch((error) => {
        (window as any).__realcameraEnumerateProfileTest.error = String(
          (error && (error.name || error.message)) || error,
        );
      });
  });

  const request = await page.evaluate(async () => {
    const api = (window as any).__realcameraTestApi;
    return await api.waitForPermissionRequest();
  });

  expect(request?.id).toBeTruthy();

  await page.evaluate(async (requestId: string) => {
    const api = (window as any).__realcameraTestApi;
    await api.respondToPermissionRequest(requestId, true);
  }, request.id);

  await page.waitForFunction(
    () => (window as any).__realcameraEnumerateProfileTest?.resolved === true,
  );

  const afterPermission = await page.evaluate(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === "videoinput")
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label,
        groupId: device.groupId,
      }));
  });

  expect(afterPermission.length).toBeGreaterThanOrEqual(2);
  expect(afterPermission.every((device) => device.deviceId.length > 0)).toBe(
    true,
  );
  expect(afterPermission.every((device) => device.label.length > 0)).toBe(
    true,
  );
  expect(afterPermission.every((device) => device.groupId.length > 0)).toBe(
    true,
  );
});