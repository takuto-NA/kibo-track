/**
 * Regression tests for overlay projection geometry (Root Cause B).
 */
import { buildFaceObjectCorners, projectPoints } from "kibo-track";
import { describe, expect, it } from "vitest";
import { projectFrontFaceCornersForPose } from "./overlay.js";
import { scaleCameraIntrinsicsToCaptureResolution } from "./resolution-gate.js";
import {
  computeMeanCornerDistancePixels,
  computeVerticalSpanPixels,
  OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS,
  OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS,
  OVERLAY_REGRESSION_CUBE_SIZE_METERS,
  OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480,
  OVERLAY_REGRESSION_LEGACY_FOCAL_LENGTH_Y_PIXELS,
  OVERLAY_REGRESSION_POSE,
  OVERLAY_REGRESSION_REFERENCE_CAMERA_INTRINSICS,
  scaleCameraIntrinsicsLegacyResizeOnly,
} from "./test-helpers/overlay-regression-fixtures.js";

/** Minimum vertical span increase from legacy anisotropic fy (pre-fix bug signature). */
const LEGACY_VERTICAL_STRETCH_MINIMUM_PIXELS = 5;

describe("overlay projection regression (Root Cause B)", () => {
  it("regression: legacy fy=600 stretches front-face projection vertically vs fixed fx=fy=450", () => {
    const legacyIntrinsics = scaleCameraIntrinsicsLegacyResizeOnly(
      OVERLAY_REGRESSION_REFERENCE_CAMERA_INTRINSICS,
      OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS,
      OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS,
    );
    const fixedIntrinsics = scaleCameraIntrinsicsToCaptureResolution(
      OVERLAY_REGRESSION_REFERENCE_CAMERA_INTRINSICS,
      OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS,
      OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS,
    );

    expect(legacyIntrinsics.focalLengthY).toBeCloseTo(OVERLAY_REGRESSION_LEGACY_FOCAL_LENGTH_Y_PIXELS);
    expect(fixedIntrinsics).toEqual(OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480);

    const legacyProjectedCorners = projectPoints(
      buildFaceObjectCorners("front", OVERLAY_REGRESSION_CUBE_SIZE_METERS),
      OVERLAY_REGRESSION_POSE,
      legacyIntrinsics,
    );
    const fixedProjectedCorners = projectPoints(
      buildFaceObjectCorners("front", OVERLAY_REGRESSION_CUBE_SIZE_METERS),
      OVERLAY_REGRESSION_POSE,
      fixedIntrinsics,
    );

    const meanCornerDistancePixels = computeMeanCornerDistancePixels(
      legacyProjectedCorners,
      fixedProjectedCorners,
    );
    const legacyVerticalSpanPixels = computeVerticalSpanPixels(legacyProjectedCorners);
    const fixedVerticalSpanPixels = computeVerticalSpanPixels(fixedProjectedCorners);

    expect(meanCornerDistancePixels).toBeGreaterThan(LEGACY_VERTICAL_STRETCH_MINIMUM_PIXELS);
    expect(legacyVerticalSpanPixels - fixedVerticalSpanPixels).toBeGreaterThan(
      LEGACY_VERTICAL_STRETCH_MINIMUM_PIXELS,
    );
  });

  it("regression: fixed intrinsics projection is self-consistent via overlay helper", () => {
    const projectedCorners = projectFrontFaceCornersForPose(
      OVERLAY_REGRESSION_POSE,
      OVERLAY_REGRESSION_CUBE_SIZE_METERS,
      OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480,
    );

    expect(projectedCorners).toHaveLength(4);
    expect(projectedCorners.every((corner) => Number.isFinite(corner[0]))).toBe(true);
    expect(computeVerticalSpanPixels(projectedCorners)).toBeGreaterThan(0);
  });
});
