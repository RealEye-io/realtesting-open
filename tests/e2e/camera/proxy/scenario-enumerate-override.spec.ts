import { test, expect } from "../../fixtures/test";

test("enumerateDevices override can simulate disconnects", async ({ page }) => {
  await page.goto("/?realcameraTest=1&devtools=1");
  await page.waitForFunction(() => (window as any).__realcameraTestApi);

  await page.evaluate(() => {
    const api = (window as any).__realcameraTestApi;
    api.setEnumerateDevicesOverride({
      devices: [
        {
          deviceId: "fake-camera-1",
          kind: "videoinput",
          label: "Fake Cam",
          groupId: "fake-group",
        },
      ],
      once: true,
    });
  });

  await page.getByRole("button", { name: "Refresh Devices" }).click();
  await page.waitForFunction(
    () =>
      document.querySelector("#deviceList")?.textContent?.includes("Fake Cam") ??
      false
  );
  const listOverride = await page.textContent("#deviceList");
  expect(listOverride ?? "").toContain("Fake Cam");

  await page.getByRole("button", { name: "Refresh Devices" }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("#deviceList")
        ?.textContent?.includes("RealCamera Virtual A") ?? false
  );
  const listNormal = await page.textContent("#deviceList");
  expect(listNormal ?? "").toContain("RealCamera Virtual A");
});
