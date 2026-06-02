import { test, expect } from "./fixtures/test";

test("browser features demo works headlessly (fullscreen, popups, clipboard)", async ({ page }) => {
  await page.goto("/?realtestingTest=1");

  await page.waitForFunction(() => (window as any).__realtestingBrowserTestApi);

  // Ensure deterministic popup behavior.
  await page.evaluate(() => {
    const api = (window as any).__realtestingBrowserTestApi;
    api.setPopupMode("virtual");
    api.setRequireUserGesture(true);
    api.setClipboardText("");
    api.closeAllPopups();
  });

  // Fullscreen should be virtual and observable via document.fullscreenElement.
  await page.getByRole("button", { name: "Enter Fullscreen" }).click();
  await page.waitForFunction(() => Boolean((document as any).fullscreenElement));

  await page.getByRole("button", { name: "Exit Fullscreen" }).click();
  await page.waitForFunction(() => !Boolean((document as any).fullscreenElement));

  // window.open should return a virtual handle and be closable.
  await page.getByRole("button", { name: "Open Popup" }).click();
  await page.waitForFunction(() => {
    const status = document.querySelector<HTMLPreElement>("#statusText");
    if (!status) return false;
    try {
      const parsed = JSON.parse(status.textContent || "{}");
      return Array.isArray(parsed.virtualPopups) && parsed.virtualPopups.length === 1;
    } catch {
      return false;
    }
  });

  await page.getByRole("button", { name: "Close All Popups" }).click();
  await page.waitForFunction(() => {
    const status = document.querySelector<HTMLPreElement>("#statusText");
    if (!status) return false;
    try {
      const parsed = JSON.parse(status.textContent || "{}");
      return Array.isArray(parsed.virtualPopups) && parsed.virtualPopups.length === 0;
    } catch {
      return false;
    }
  });

  // Clipboard API should work in virtual mode.
  await page.locator("#clipboardInput").fill("Clipboard API works");
  await page.getByRole("button", { name: "Copy (Clipboard API)" }).click();
  await page.getByRole("button", { name: "Paste (Clipboard API)" }).click();
  await expect(page.locator("#clipboardReadback")).toContainText('readText() -> "Clipboard API works"');

  // execCommand("copy") should also populate the virtual clipboard.
  await page.locator("#execCommandInput").fill("execCommand works");
  await page.getByRole("button", { name: "Copy (execCommand)" }).click();
  await page.getByRole("button", { name: "Paste (Clipboard API)" }).click();
  await expect(page.locator("#clipboardReadback")).toContainText('readText() -> "execCommand works"');
});
