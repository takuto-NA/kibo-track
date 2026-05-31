/**
 * Browser smoke test for camera startup and resolution gates with fake camera.
 */
import { expect, test } from "@playwright/test";
import {
  createBrowserDiagnosticsCollector,
  readDiagnosticsFromPage,
  type BrowserDiagnosticsCollector,
} from "./browser-diagnostics.js";

test.describe("camera startup browser gate", () => {
  let diagnosticsCollector: BrowserDiagnosticsCollector;

  test.beforeEach(({ page }) => {
    diagnosticsCollector = createBrowserDiagnosticsCollector();
    diagnosticsCollector.attach(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== "passed") {
      await page.screenshot({
        path: testInfo.outputPath("failure.png"),
        fullPage: true,
      });
      await diagnosticsCollector.writeFailureArtifacts(testInfo.outputDir, testInfo.title);
    }
  });

  test("reaches cameraReady and resolutionReady with fake camera", async ({ page }) => {
    await page.goto("/");
    await page.locator("#start-camera-button").click();

    await expect(page.locator("#app-status")).toHaveText("resolutionReady", {
      timeout: 30_000,
    });
    await expect(page.locator("#camera-status")).toContainText("cameraReady");
    await expect(page.locator("#resolution-status")).toHaveText("resolutionReady");

    await readDiagnosticsFromPage(page, diagnosticsCollector);

    const diagnosticsText = diagnosticsCollector.snapshot.diagnosticsText;
    expect(diagnosticsText).toContain("video:");
    expect(diagnosticsText).toContain("captureCanvas:");
    expect(diagnosticsText).toContain("overlayCanvas:");

    diagnosticsCollector.assertClean();
  });

  test("shows a single preview layer after camera startup", async ({ page }) => {
    await page.goto("/");
    await page.locator("#start-camera-button").click();

    await expect(page.locator("#app-status")).toHaveText("resolutionReady", {
      timeout: 30_000,
    });

    await expect(page.locator("#camera-video")).toBeHidden();
    await expect(page.locator("#capture-canvas")).toBeHidden();
    await expect(page.locator("#overlay-canvas")).toBeVisible();
  });
});
