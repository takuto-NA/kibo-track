/**
 * Browser smoke test for the GitHub Pages project-site base path and detector startup.
 */
import { expect, test } from "@playwright/test";
import {
  createBrowserDiagnosticsCollector,
  readDiagnosticsFromPage,
  type BrowserDiagnosticsCollector,
} from "./browser-diagnostics.js";

test.describe("GitHub Pages demo browser gate", () => {
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

  test("loads under /kibo-track/, starts camera, and initializes detector assets", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("#start-camera-button").click();

    await expect(page.locator("#app-status")).toHaveText("resolutionReady", {
      timeout: 30_000,
    });
    await expect(page.locator("#camera-status")).toContainText("cameraReady");
    await expect(page.locator("#resolution-status")).toHaveText("resolutionReady");

    await page.locator("#start-detector-button").click();
    await expect(page.locator("#detector-status")).toHaveText("detectorReady", {
      timeout: 30_000,
    });

    await readDiagnosticsFromPage(page, diagnosticsCollector);
    expect(diagnosticsCollector.snapshot.diagnosticsText).not.toContain("insecureContext");
    expect(diagnosticsCollector.snapshot.diagnosticsText).not.toContain("wasmMissing");
    diagnosticsCollector.assertClean();
  });
});
