/**
 * Regression coverage for static AprilCube photo detections that Python solves as single tags.
 */
import { describe, expect, it } from "vitest";
import { estimateAprilCubePose } from "../../src/aprilcube/estimate-aprilcube-pose.js";
import { isPoseFacingCameraForMarkers } from "../../src/aprilcube/pose-facing-camera.js";
import type { AprilCubeConfig } from "../../src/aprilcube/types.js";
import {
  CANONICAL_CAMERA_INTRINSICS,
  STANDARD_APRILCUBE_CONFIG,
  createProjectedAprilCubeMarkers,
  injectBadCornerOnFirstMarker,
} from "../fixtures/aprilcube-config.js";
import {
  STATIC_PHOTO_APRILCUBE_CONFIG,
  STATIC_PHOTO_BACK_MARKER_5,
  STATIC_PHOTO_GOLDEN_TRANSLATION_TOLERANCE_METERS,
  STATIC_PHOTO_MARKER_5_GOLDEN_DEPTH_METERS,
  STATIC_PHOTO_MARKERS_1_AND_5,
  STATIC_PHOTO_MAXIMUM_GOOD_REPROJECTION_ERROR_PX,
  buildStaticPhotoEstimateInput,
  staticPhotoPoseHasGoodReprojection,
} from "../fixtures/static-aprilcube-photo-corners.js";

describe("static AprilCube detected corner regressions", () => {
  it("solves marker 5 with low reprojection error and positive camera depth", () => {
    const input = buildStaticPhotoEstimateInput([STATIC_PHOTO_BACK_MARKER_5]);
    const result = estimateAprilCubePose(input, { enableRansac: false });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.finalMeanReprojectionErrorPx).toBeLessThan(
      STATIC_PHOTO_MAXIMUM_GOOD_REPROJECTION_ERROR_PX,
    );
    expect(result.pose.translation[2]).toBeGreaterThan(0);
    expect(
      Math.abs(result.pose.translation[2] - STATIC_PHOTO_MARKER_5_GOLDEN_DEPTH_METERS),
    ).toBeLessThan(STATIC_PHOTO_GOLDEN_TRANSLATION_TOLERANCE_METERS);
    expect(isPoseFacingCameraForMarkers(input, [5], result.pose)).toBe(true);
  });

  it("solves two-marker input with facing pose and consistent marker ids", () => {
    const input = buildStaticPhotoEstimateInput(STATIC_PHOTO_MARKERS_1_AND_5);
    const result = estimateAprilCubePose(input, { enableRansac: false });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.finalMeanReprojectionErrorPx).toBeLessThan(
      STATIC_PHOTO_MAXIMUM_GOOD_REPROJECTION_ERROR_PX,
    );
    expect(result.detectedMarkerIds).toEqual([1, 5]);
    expect(isPoseFacingCameraForMarkers(input, [1, 5], result.pose)).toBe(true);
  });

  it("fails corner-order A/B: canonical order breaks static marker 5 fit", () => {
    const canonicalConfig: AprilCubeConfig = {
      ...STATIC_PHOTO_APRILCUBE_CONFIG,
      cornerOrder: "canonical",
    };
    const input = buildStaticPhotoEstimateInput([STATIC_PHOTO_BACK_MARKER_5], canonicalConfig);
    const result = estimateAprilCubePose(input, { enableRansac: false });
    const finalMeanReprojectionErrorPx = result.success
      ? result.finalMeanReprojectionErrorPx
      : Number.POSITIVE_INFINITY;

    expect(staticPhotoPoseHasGoodReprojection(result.success, finalMeanReprojectionErrorPx)).toBe(
      false,
    );
  });

  it("re-solves when three synthetic markers include one injected outlier corner", () => {
    const markers = injectBadCornerOnFirstMarker(
      createProjectedAprilCubeMarkers(STANDARD_APRILCUBE_CONFIG),
      120,
    );
    const result = estimateAprilCubePose(
      {
        markers,
        config: STANDARD_APRILCUBE_CONFIG,
        cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
      },
      { enableRansac: false },
    );

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.rejectedMarkerIds.length).toBeGreaterThan(0);
    expect(result.finalMeanReprojectionErrorPx).toBeLessThan(
      STATIC_PHOTO_MAXIMUM_GOOD_REPROJECTION_ERROR_PX,
    );
  });
});
