/**
 * Integration tests for estimatePose without and with RANSAC.
 */
import { describe, expect, it } from "vitest";
import {
  ANGLE_TOLERANCE_RADIANS,
  REPROJECTION_ERROR_TOLERANCE_PX,
} from "../../src/core/constants.js";
import { quaternionToRotationVector } from "../../src/core/rodrigues.js";
import { estimatePose } from "../../src/pnp/estimate-pose.js";
import type { EstimatePoseSuccess } from "../../src/pnp/estimate-pose-types.js";
import {
  CANONICAL_CAMERA_INTRINSICS,
  ESTIMATE_POSE_GROUND_TRUTH_POSE,
  EXPECTED_RANSAC_INLIER_COUNT,
  EXPECTED_RANSAC_OUTLIER_INDICES,
  NON_COPLANAR_OBJECT_POINTS,
  RANSAC_RANDOM_SEED,
  SYNTHETIC_OBSERVATION_NOISE_PX,
  createOutlierEstimatePoseCorrespondences,
  projectEstimatePoseGroundTruthImagePoints,
  projectNoisyEstimatePoseImagePoints,
} from "../fixtures/estimate-pose-correspondences.js";

const TRANSLATION_TOLERANCE_METERS = 1e-3;

function assertEstimatePoseSuccess(
  result: ReturnType<typeof estimatePose>,
): EstimatePoseSuccess {
  if (!result.success) {
    throw new Error(`Expected estimatePose success but received ${result.reason}.`);
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

  const deltaRotationVector: [number, number, number] = [
    estimatedRotationVector[0] - groundTruthRotationVector[0],
    estimatedRotationVector[1] - groundTruthRotationVector[1],
    estimatedRotationVector[2] - groundTruthRotationVector[2],
  ];

  return Math.hypot(
    deltaRotationVector[0],
    deltaRotationVector[1],
    deltaRotationVector[2],
  );
}

describe("estimatePose validation failures", () => {
  it("returns notEnoughPoints for fewer than four correspondences", () => {
    const result = estimatePose({
      imagePoints: projectEstimatePoseGroundTruthImagePoints().slice(0, 3),
      objectPoints: NON_COPLANAR_OBJECT_POINTS.slice(0, 3),
      cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("notEnoughPoints");
    }
  });

  it("returns degenerateConfiguration for coplanar object points", () => {
    const result = estimatePose(
      {
        imagePoints: [
          [640, 360],
          [740, 360],
          [640, 460],
          [740, 460],
        ],
        objectPoints: [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
          [1, 1, 0],
        ],
        cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
      },
      { enableRansac: false },
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("degenerateConfiguration");
    }
  });
});

describe("estimatePose without RANSAC", () => {
  it("recovers pose on clean non-coplanar synthetic data", () => {
    const result = assertEstimatePoseSuccess(
      estimatePose(
        {
          imagePoints: projectEstimatePoseGroundTruthImagePoints(),
          objectPoints: NON_COPLANAR_OBJECT_POINTS,
          cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
        },
        { enableRansac: false },
      ),
    );

    expect(result.finalMeanReprojectionErrorPx).toBeLessThan(
      result.initialMeanReprojectionErrorPx + 1e-6,
    );
    expect(result.finalMeanReprojectionErrorPx).toBeCloseTo(
      0,
      REPROJECTION_ERROR_TOLERANCE_PX,
    );
    expect(
      computeTranslationErrorMeters(
        result.pose.translation,
        ESTIMATE_POSE_GROUND_TRUTH_POSE.translation,
      ),
    ).toBeLessThan(TRANSLATION_TOLERANCE_METERS);
    expect(
      computeRotationErrorRadians(
        result.pose.rotation,
        ESTIMATE_POSE_GROUND_TRUTH_POSE.rotation,
      ),
    ).toBeLessThan(ANGLE_TOLERANCE_RADIANS * 1000);
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.numInliers).toBe(NON_COPLANAR_OBJECT_POINTS.length);
  });

  it("refines noisy observations below the initial EPnP reprojection error", () => {
    const result = assertEstimatePoseSuccess(
      estimatePose(
        {
          imagePoints: projectNoisyEstimatePoseImagePoints(),
          objectPoints: NON_COPLANAR_OBJECT_POINTS,
          cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
        },
        { enableRansac: false },
      ),
    );

    expect(result.finalMeanReprojectionErrorPx).toBeLessThan(
      result.initialMeanReprojectionErrorPx,
    );
    expect(result.finalMeanReprojectionErrorPx).toBeLessThan(
      SYNTHETIC_OBSERVATION_NOISE_PX,
    );
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});

describe("estimatePose with RANSAC", () => {
  it("rejects known outlier indices and keeps expected inliers", () => {
    const outlierCorrespondences = createOutlierEstimatePoseCorrespondences();

    const result = assertEstimatePoseSuccess(
      estimatePose(
        {
          imagePoints: outlierCorrespondences.imagePoints,
          objectPoints: outlierCorrespondences.objectPoints,
          cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
        },
        {
          randomSeed: RANSAC_RANDOM_SEED,
          reprojectionErrorThresholdPx: 5,
        },
      ),
    );

    expect(result.numInliers).toBeGreaterThanOrEqual(EXPECTED_RANSAC_INLIER_COUNT - 1);
    for (const outlierIndex of EXPECTED_RANSAC_OUTLIER_INDICES) {
      expect(result.outlierIndices).toContain(outlierIndex);
    }
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});
