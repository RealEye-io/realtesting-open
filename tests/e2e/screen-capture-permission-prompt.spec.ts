import { test, expect } from "./fixtures/test";

test("virtual screen share prompt blocks until user responds", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__REALTESTING_TEST_CONFIG__ = {
      enabled: true,
      captureMode: "virtual",
      virtualPermission: "prompt",
      permissionPromptMode: "manual",
      permissionPromptTimeoutMs: 0,
      blockNativeDisplayMedia: true,
      virtualSourceOverride: { type: "color", color: "#00ff00", text: "GREEN" },
    };
  });

  await page.goto("/?realtestingTest=1");
  await page.waitForFunction(() => (window as any).__realtestingTestApi);

  // Start capture: should block on the virtual permission prompt.
  await page.getByRole("button", { name: "Start Capture" }).click();

  const prompt = await page.evaluate(async () => {
    const api = (window as any).__realtestingTestApi;
    return await api.waitForPermissionPrompt();
  });

  expect(prompt?.id).toBeTruthy();

  // Confirm we haven't started streaming yet.
  expect(
    await page.evaluate(() => {
      const video = document.querySelector<HTMLVideoElement>("#preview");
      return Boolean(video && video.readyState >= 2 && video.videoWidth > 0);
    })
  ).toBe(false);

  // Simulate user clicking "Allow".
  await page.evaluate(async (id: string) => {
    const api = (window as any).__realtestingTestApi;
    await api.respondToPermissionPrompt(id, true, { afterMs: 250 });
  }, prompt.id);

  // Then the preview should become ready.
  await page.waitForFunction(() => {
    const video = document.querySelector<HTMLVideoElement>("#preview");
    return Boolean(video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0);
  });

  // And there should be no error box visible.
  await expect(page.locator("#errorBox")).toBeHidden();
});
