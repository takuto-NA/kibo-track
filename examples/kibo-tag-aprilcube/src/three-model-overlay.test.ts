/**
 * Unit tests for three.js model overlay render decisions.
 */
import { describe, expect, it } from "vitest";
import { shouldDrawThreeModelOverlay } from "./three-model-overlay.js";
import {
  OVERLAY_REGRESSION_CUBE_SIZE_METERS,
  OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480,
  OVERLAY_REGRESSION_POSE,
} from "./test-helpers/overlay-regression-fixtures.js";

describe("three model overlay", () => {
  it("hides model overlay when pose is unavailable", () => {
    expect(
      shouldDrawThreeModelOverlay({
        overlayDisplayMode: "cameraWithModel",
        cameraFromObjectPose: null,
        cameraIntrinsics: OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480,
        captureCanvas: document.createElement("canvas"),
        cubeSizeMeters: OVERLAY_REGRESSION_CUBE_SIZE_METERS,
      }),
    ).toBe(false);
  });

  it("renders model overlay when pose and intrinsics are available", () => {
    expect(
      shouldDrawThreeModelOverlay({
        overlayDisplayMode: "modelOnly",
        cameraFromObjectPose: OVERLAY_REGRESSION_POSE,
        cameraIntrinsics: OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480,
        captureCanvas: document.createElement("canvas"),
        cubeSizeMeters: OVERLAY_REGRESSION_CUBE_SIZE_METERS,
      }),
    ).toBe(true);
  });
});
