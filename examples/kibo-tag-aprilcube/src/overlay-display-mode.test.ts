/**
 * Unit tests for overlay display mode parsing and visibility predicates.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_OVERLAY_DISPLAY_MODE,
  readOverlayDisplayModeFromSelectValue,
  renderOverlayDisplayModeSelectOptions,
  shouldRenderThreeModelForPose,
  shouldShowCameraFeed,
  shouldShowThreeModelOverlay,
  shouldShowWireframeOverlay,
  shouldUseOverlayOnlyBackground,
} from "./overlay-display-mode.js";

describe("overlay display mode", () => {
  it("defaults to camera with wireframe", () => {
    expect(DEFAULT_OVERLAY_DISPLAY_MODE).toBe("cameraWithWireframe");
  });

  it("falls back to default for unknown select values", () => {
    expect(readOverlayDisplayModeFromSelectValue("invalid")).toBe("cameraWithWireframe");
  });

  it("renders all overlay mode options", () => {
    const overlayDisplayModeSelect = document.createElement("select");

    renderOverlayDisplayModeSelectOptions(overlayDisplayModeSelect);

    expect(overlayDisplayModeSelect.value).toBe("cameraWithWireframe");
    expect(Array.from(overlayDisplayModeSelect.options).map((option) => option.value)).toEqual([
      "cameraWithWireframe",
      "wireframeOnly",
      "cameraWithModel",
      "modelOnly",
    ]);
  });

  it("maps visibility predicates per mode", () => {
    expect(shouldShowCameraFeed("cameraWithModel")).toBe(true);
    expect(shouldShowWireframeOverlay("cameraWithModel")).toBe(false);
    expect(shouldShowThreeModelOverlay("cameraWithModel")).toBe(true);
    expect(shouldUseOverlayOnlyBackground("modelOnly")).toBe(true);
    expect(shouldRenderThreeModelForPose("cameraWithModel", false)).toBe(false);
    expect(shouldRenderThreeModelForPose("cameraWithModel", true)).toBe(true);
  });
});
