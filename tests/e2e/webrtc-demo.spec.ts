import { test, expect } from "./fixtures/test";

test("webrtc demo connects headlessly and exchanges messages over DataChannel", async ({ page }) => {
  await page.goto("/?realtestingTest=1");
  await page.waitForFunction(() => (window as any).__realtestingWebrtcTestApi);

  await page.evaluate(async () => {
    const api = (window as any).__realtestingWebrtcTestApi;
    await api.configure({
      rtcMode: "virtual",
      blockNativePeerConnection: true,
    });
    api.closeAllVirtualConnections();
  });

  await page.getByRole("button", { name: "Connect Peers" }).click();

  await page.waitForFunction(() => {
    const status = document.querySelector<HTMLPreElement>("#statusText");
    if (!status) return false;
    try {
      const parsed = JSON.parse(status.textContent || "{}");
      return (
        parsed?.dataChannel?.a?.readyState === "open" &&
        parsed?.dataChannel?.b?.readyState === "open"
      );
    } catch {
      return false;
    }
  });

  await page.locator("#messageInput").fill("hello");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator("#logText")).toContainText("B <= hello");

  // Strict native mode with native blocked should fail fast (no network attempt).
  await page.evaluate(() => {
    const api = (window as any).__realtestingWebrtcTestApi;
    api.setRtcMode("native");
    api.setBlockNativePeerConnection(true);
  });

  await page.getByRole("button", { name: "Connect Peers" }).click();
  await expect(page.locator("#errorBox")).toContainText("NotAllowedError", {
    timeout: 5000,
  });
});

