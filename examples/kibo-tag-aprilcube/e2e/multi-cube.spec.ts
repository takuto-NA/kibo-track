/**
 * Browser smoke test for the multi-cube demo: page loads, 16 configs auto-load, camera startup.
 */
import { expect, test } from "@playwright/test";
import {
  createBrowserDiagnosticsCollector,
  readDiagnosticsFromPage,
  type BrowserDiagnosticsCollector,
} from "./browser-diagnostics.js";

test.describe("multi-cube demo browser gate", () => {
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

  test("auto-loads 16 cube configs on page open and reports the union tag range", async ({ page }) => {
    await page.goto("/multi-cube.html");

    await expect(page.locator("#multi-cube-config-status")).toContainText("loaded: 16 cubes", {
      timeout: 15_000,
    });
    await expect(page.locator("#multi-cube-config-status")).toContainText("dict=DICT_4X4_100");
    await expect(page.locator("#multi-cube-config-status")).toContainText("tags=96");
    await expect(page.locator("#multi-cube-config-status")).toContainText("(0..95)");

    await expect(page.locator("#per-cube-status-grid")).toContainText("[00]");
    await expect(page.locator("#per-cube-status-grid")).toContainText("[15]");
    await expect(page.locator("#per-cube-status-grid")).toContainText("model=Chick");
    await expect(page.locator("#per-cube-status-grid")).toContainText("model=Sword_Diamond");
  });

  test("defaults to Camera + 3D model overlay mode", async ({ page }) => {
    await page.goto("/multi-cube.html");

    await expect(page.locator("#overlay-display-mode-select")).toHaveValue("cameraWithModel");
  });

  test("reaches resolutionReady with fake camera and keeps 16-cube grid visible", async ({ page }) => {
    await page.goto("/multi-cube.html");

    await expect(page.locator("#multi-cube-config-status")).toContainText("loaded: 16 cubes", {
      timeout: 15_000,
    });

    await page.locator("#start-camera-button").click();

    await expect(page.locator("#app-status")).toHaveText("resolutionReady", {
      timeout: 30_000,
    });
    await expect(page.locator("#camera-status")).toContainText("cameraReady");
    await expect(page.locator("#resolution-status")).toHaveText("resolutionReady");

    // Start Detector button is enabled only when configs + resolution are both ready.
    await expect(page.locator("#start-detector-button")).toBeEnabled();

    await readDiagnosticsFromPage(page, diagnosticsCollector);

    const diagnosticsText = diagnosticsCollector.snapshot.diagnosticsText;
    expect(diagnosticsText).toContain("multiCubeConfigLoaded: true");
    expect(diagnosticsText).toContain("cubeTracking: 0/16");
    expect(diagnosticsText).toContain("overlayDisplayMode: cameraWithModel");

    diagnosticsCollector.assertClean();
  });

  test("loads 16 glTF 3D models after camera startup in cameraWithModel mode", async ({ page }) => {
    await page.goto("/multi-cube.html");

    await expect(page.locator("#multi-cube-config-status")).toContainText("loaded: 16 cubes", {
      timeout: 15_000,
    });

    await page.locator("#start-camera-button").click();

    await expect(page.locator("#app-status")).toHaveText("resolutionReady", {
      timeout: 30_000,
    });

    // The 3D overlay starts loading after camera startup. Wait for it to complete.
    await expect(page.locator("#diagnostics-text")).toContainText("threeOverlayLoaded: true", {
      timeout: 30_000,
    });

    await readDiagnosticsFromPage(page, diagnosticsCollector);

    const diagnosticsText = diagnosticsCollector.snapshot.diagnosticsText;
    expect(diagnosticsText).toContain("threeOverlayLoadError: none");

    diagnosticsCollector.assertClean();
  });
});
