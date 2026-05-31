/**
 * Regression: tag-projected 2D with face-corner 3D must mis-estimate pose;
 * tag-projected 2D with tag-corner 3D must recover ground truth.
 */
import { describe, expect, it } from "vitest";
import { REPROJECTION_ERROR_TOLERANCE_PX } from "../../src/core/constants.js";
import { estimateAprilCubePose } from "../../src/aprilcube/estimate-aprilcube-pose.js";
import type { EstimateAprilCubePoseSuccess } from "../../src/aprilcube/types.js";
import {
  APRILCUBE_GROUND_TRUTH_POSE,
} from "../fixtures/aprilcube-config.js";
import { CANONICAL_CAMERA_INTRINSICS } from "../fixtures/canonical-camera-intrinsics.js";
import {
  createExampleTagProjectedMarkers,
  EXAMPLE_FACE_ONLY_CONFIG,
  EXAMPLE_TAG_GEOMETRY_CONFIG,
  GEOMETRY_MISMATCH_MIN_METERS,
} from "../fixtures/example-aprilcube-layout.js";

const TRANSLATION_TOLERANCE_METERS = 1e-6;

function assertPoseSuccess(
  result: ReturnType<typeof estimateAprilCubePose>,
): EstimateAprilCubePoseSuccess {
  if (!result.success) {
    throw new Error(
      `Expected pose success but received ${result.stage}:${result.reason}.`,
    );
  }

  return result;
}

function computeTranslationErrorMeters(
  estimatedTranslation: readonly [number, number, number],
  groundTruthTranslation: readonly [number, number, number],
): number {
  const deltaX = estimatedTranslation[0] - groundTruthTranslation[0];
  const deltaY = estimatedTranslation[1] - groundTruthTranslation[1];
  const deltaZ = estimatedTranslation[2] - groundTruthTranslation[2];
  return Math.hypot(deltaX, deltaY, deltaZ);
}

describe("AprilCube geometry mismatch regression", () => {
  const tagProjectedMarkers = createExampleTagProjectedMarkers();

  it("mis-estimates pose when tag 2D is paired with face-corner 3D", () => {
    const faceOnlyResult = assertPoseSuccess(
      estimateAprilCubePose(
        {
          markers: tagProjectedMarkers,
          config: EXAMPLE_FACE_ONLY_CONFIG,
          cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
        },
        { enableRansac: false },
      ),
    );

    const translationError = computeTranslationErrorMeters(
      faceOnlyResult.pose.translation,
      APRILCUBE_GROUND_TRUTH_POSE.translation,
    );

    expect(translationError).toBeGreaterThan(GEOMETRY_MISMATCH_MIN_METERS);
  });

  it("recovers ground-truth pose when tag 2D is paired with tag-corner 3D", () => {
    const tagGeometryResult = assertPoseSuccess(
      estimateAprilCubePose(
        {
          markers: tagProjectedMarkers,
          config: EXAMPLE_TAG_GEOMETRY_CONFIG,
          cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
        },
        { enableRansac: false },
      ),
    );

    const translationError = computeTranslationErrorMeters(
      tagGeometryResult.pose.translation,
      APRILCUBE_GROUND_TRUTH_POSE.translation,
    );

    expect(translationError).toBeLessThan(TRANSLATION_TOLERANCE_METERS);
    expect(tagGeometryResult.finalMeanReprojectionErrorPx).toBeCloseTo(
      0,
      REPROJECTION_ERROR_TOLERANCE_PX,
    );
  });
});
