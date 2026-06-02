import { test, expect } from "./fixtures/test";

const ECHO_URL = "ws://realtesting.local/echo";

test("websocket demo uses virtual echo server headlessly (no real network)", async ({ page }) => {
  await page.goto("/?realtestingTest=1");
  await page.waitForFunction(() => (window as any).__realtestingWebSocketTestApi);

  await page.evaluate(async (url) => {
    const api = (window as any).__realtestingWebSocketTestApi;
    await api.configure({
      socketMode: "virtual",
      blockNativeWebSocket: true,
    });
    api.clearServers();
    api.createEchoServer(url);
  }, ECHO_URL);

  await page.locator("#connectSocket").click();

  await page.waitForFunction(() => {
    const status = document.querySelector<HTMLPreElement>("#statusText");
    if (!status) return false;
    try {
      const parsed = JSON.parse(status.textContent || "{}");
      return parsed?.socket?.readyState === 1;
    } catch {
      return false;
    }
  });

  await page.locator("#messageInput").fill("ping");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator("#logText")).toContainText("<= ping");

  // Strict native mode with native blocked should error/close deterministically.
  await page.evaluate(() => {
    const api = (window as any).__realtestingWebSocketTestApi;
    api.setSocketMode("native");
    api.setBlockNativeWebSocket(true);
  });

  await page.locator("#connectSocket").click();
  await expect(page.locator("#logText")).toContainText("socket error", { timeout: 5000 });
});
