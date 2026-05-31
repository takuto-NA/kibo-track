/**
 * Optional local-only real camera gate for the AprilCube example.
 */
import { expect, test } from "@playwright/test";
import { createBrowserDiagnosticsCollector } from "./browser-diagnostics.js";

test.describe("real camera final gate", () => {
  test.skip(
    !process.env.RUN_REAL_CAMERA,
    "Set RUN_REAL_CAMERA=1 to run the local real-camera gate.",
  );

  test("starts the real camera and reaches resolutionReady", async ({ page }) => {
    const diagnosticsCollector = createBrowserDiagnosticsCollector();
    diagnosticsCollector.attach(page);

    await page.goto("/");
    await page.locator("#start-camera-button").click();

    await expect(page.locator("#app-status")).toHaveText("resolutionReady", {
      timeout: 30_000,
    });
    await expect(page.locator("#camera-status")).toContainText("cameraReady");
    await expect(page.locator("#resolution-status")).toHaveText("resolutionReady");

    const diagnosticsText = await page.locator("#diagnostics-text").textContent();
    expect(diagnosticsText).toContain("video:");
    expect(diagnosticsText).toMatch(/scaledFx:/);

    diagnosticsCollector.assertClean();

    await page.screenshot({
      path: "test-results/playwright/real-camera-success.png",
      fullPage: true,
    });
  });
});
