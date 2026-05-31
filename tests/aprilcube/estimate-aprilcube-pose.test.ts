/**
 * Integration tests for estimateAprilCubePose.
 */
import { describe, expect, it } from "vitest";
import {
  ANGLE_TOLERANCE_RADIANS,
  REPROJECTION_ERROR_TOLERANCE_PX,
} from "../../src/core/constants.js";
import { quaternionToRotationVector } from "../../src/core/rodrigues.js";
import { estimateAprilCubePose } from "../../src/aprilcube/estimate-aprilcube-pose.js";
import type { EstimateAprilCubePoseSuccess } from "../../src/aprilcube/types.js";
import {
  APRILCUBE_FRONT_MARKER_ID,
  APRILCUBE_GROUND_TRUTH_POSE,
  APRILCUBE_OBSERVATION_NOISE_PX,
  APRILCUBE_RANSAC_RANDOM_SEED,
  CANONICAL_CAMERA_INTRINSICS,
  TWO_FACE_APRILCUBE_CONFIG,
  SINGLE_FACE_APRILCUBE_CONFIG,
  addDeterministicNoiseToAprilCubeMarkers,
  createProjectedAprilCubeMarkers,
  createSingleFaceAprilCubeMarkers,
  injectBadCornerOnFirstMarker,
} from "../fixtures/aprilcube-config.js";

const TRANSLATION_TOLERANCE_METERS = 1e-6;

function assertAprilCubePoseSuccess(
  result: ReturnType<typeof estimateAprilCubePose>,
): EstimateAprilCubePoseSuccess {
  if (!result.success) {
    throw new Error(
      `Expected estimateAprilCubePose success but received ${result.stage}:${result.reason}.`,
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

function computeRotationErrorRadians(
  estimatedRotation: readonly [number, number, number, number],
  groundTruthRotation: readonly [number, number, number, number],
): number {
  const estimatedRotationVector = quaternionToRotationVector(estimatedRotation);
  const groundTruthRotationVector = quaternionToRotationVector(groundTruthRotation);

  return Math.hypot(
    estimatedRotationVector[0] - groundTruthRotationVector[0],
    estimatedRotationVector[1] - groundTruthRotationVector[1],
    estimatedRotationVector[2] - groundTruthRotationVector[2],
  );
}

describe("estimateAprilCubePose integration", () => {
  it("recovers pose from a clean two-face synthetic fixture", () => {
    const result = assertAprilCubePoseSuccess(
      estimateAprilCubePose(
        {
          markers: createProjectedAprilCubeMarkers(TWO_FACE_APRILCUBE_CONFIG),
          config: TWO_FACE_APRILCUBE_CONFIG,
          cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
        },
        { enableRansac: false },
      ),
    );

    expect(result.correspondenceCount).toBe(8);
    expect(result.detectedMarkerCount).toBe(2);
    expect(result.finalMeanReprojectionErrorPx).toBeCloseTo(
      0,
      REPROJECTION_ERROR_TOLERANCE_PX,
    );
    expect(
      computeTranslationErrorMeters(
        result.pose.translation,
        APRILCUBE_GROUND_TRUTH_POSE.translation,
      ),
    ).toBeLessThan(TRANSLATION_TOLERANCE_METERS);
    expect(
      computeRotationErrorRadians(
        result.pose.rotation,
        APRILCUBE_GROUND_TRUTH_POSE.rotation,
      ),
    ).toBeLessThan(ANGLE_TOLERANCE_RADIANS);
    expect(result.numInliers).toBe(8);
    expect(result.outlierIndices).toEqual([]);
    expect(result.confidence).toBeGreaterThanOrEqual(0.99);
  });

  it("handles noisy two-face observations", () => {
    const noisyMarkers = addDeterministicNoiseToAprilCubeMarkers(
      createProjectedAprilCubeMarkers(TWO_FACE_APRILCUBE_CONFIG),
    );

    const result = assertAprilCubePoseSuccess(
      estimateAprilCubePose(
        {
          markers: noisyMarkers,
          config: TWO_FACE_APRILCUBE_CONFIG,
          cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
        },
        { enableRansac: false },
      ),
    );

    expect(result.finalMeanReprojectionErrorPx).toBeLessThan(0.75);
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.finalMeanReprojectionErrorPx).toBeLessThan(APRILCUBE_OBSERVATION_NOISE_PX);
  });

  it("rejects a bad corner with RANSAC and reports marker diagnostics", () => {
    const outlierMarkers = injectBadCornerOnFirstMarker(
      createProjectedAprilCubeMarkers(TWO_FACE_APRILCUBE_CONFIG),
      80,
    );

    const result = assertAprilCubePoseSuccess(
      estimateAprilCubePose(
        {
          markers: outlierMarkers,
          config: TWO_FACE_APRILCUBE_CONFIG,
          cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
        },
        {
          randomSeed: APRILCUBE_RANSAC_RANDOM_SEED,
          reprojectionErrorThresholdPx: 5,
        },
      ),
    );

    expect(result.outlierMarkerDiagnostics.length).toBeGreaterThan(0);
    expect(result.outlierMarkerDiagnostics[0]?.markerId).toBe(APRILCUBE_FRONT_MARKER_ID);
    expect(result.outlierMarkerDiagnostics[0]?.cornerIndex).toBe(0);
    expect(result.numInliers).toBeGreaterThanOrEqual(7);
  });

  it("returns singleFacePlanar for one marker without prior when one candidate resolves", () => {
    const result = estimateAprilCubePose(
      {
        markers: createSingleFaceAprilCubeMarkers(),
        config: SINGLE_FACE_APRILCUBE_CONFIG,
        cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
      },
      { enableRansac: false },
    );

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.poseMode).toBe("singleFacePlanar");
  });
});
