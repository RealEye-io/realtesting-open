import { test, expect } from "../../fixtures/test";

test("proxy app lists virtual devices and streams", async ({ page }) => {
  await page.goto("/?devtools=1");
  await page.waitForFunction(() => {
    const select = document.querySelector<HTMLSelectElement>("#deviceSelect");
    return select && select.options.length > 0;
  });

  const optionLabels = await page.$$eval("#deviceSelect option", (options) =>
    options.map((option) => option.textContent ?? "")
  );
  expect(optionLabels.join(" ")).toContain("RealCamera Virtual A");
  expect(optionLabels.join(" ")).toContain("RealCamera Virtual B");

  await page.getByRole("button", { name: "Start Stream" }).click();
  await page.waitForFunction(() => {
    const video = document.querySelector<HTMLVideoElement>("#preview");
    return video && video.readyState >= 2 && video.videoWidth > 0;
  });

  await page.getByRole("button", { name: "Disable Physical Devices" }).click();
  await expect(
    page.getByRole("button", { name: "Enable Physical Devices" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Refresh Devices" }).click();
  const listText = await page.textContent("#deviceList");
  expect(listText ?? "").toContain("RealCamera Virtual A");
  expect(listText ?? "").toContain("RealCamera Virtual B");

  await page.getByRole("button", { name: "Disconnect" }).click();
  await page.getByRole("button", { name: "Refresh Devices" }).click();
  const listAfterDisconnect = await page.textContent("#deviceList");
  expect(listAfterDisconnect ?? "").not.toContain("RealCamera Virtual A");

  await page.getByRole("button", { name: "Connect" }).click();
  await page.getByRole("button", { name: "Refresh Devices" }).click();
  const listAfterConnect = await page.textContent("#deviceList");
  expect(listAfterConnect ?? "").toContain("RealCamera Virtual A");
});
