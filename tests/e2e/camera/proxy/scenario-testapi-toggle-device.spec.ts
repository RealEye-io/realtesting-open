import { test, expect } from "../../fixtures/test";

test("test API can toggle device availability", async ({ page }) => {
  await page.goto("/?realcameraTest=1&devtools=1");
  await page.waitForFunction(() => (window as any).__realcameraTestApi);

  const device = await page.evaluate(() => {
    const api = (window as any).__realcameraTestApi;
    return api.listVirtualDevices()[0];
  });

  await page.evaluate((id: string) => {
    const api = (window as any).__realcameraTestApi;
    api.setVirtualEnabled(id, false);
  }, device.id);

  await page.getByRole("button", { name: "Refresh Devices" }).click();
  await page.waitForFunction(
    (label) =>
      !(document.querySelector("#deviceList")?.textContent ?? "").includes(label),
    device.label
  );
  const listAfterDisable = await page.textContent("#deviceList");
  expect(listAfterDisable ?? "").not.toContain(device.label);

  await page.evaluate((id: string) => {
    const api = (window as any).__realcameraTestApi;
    api.setVirtualEnabled(id, true);
  }, device.id);

  await page.getByRole("button", { name: "Refresh Devices" }).click();
  await page.waitForFunction(
    (label) =>
      (document.querySelector("#deviceList")?.textContent ?? "").includes(label),
    device.label
  );
  const listAfterEnable = await page.textContent("#deviceList");
  expect(listAfterEnable ?? "").toContain(device.label);
});
