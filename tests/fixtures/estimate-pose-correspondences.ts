/**
 * Synthetic correspondences and perturbations for estimatePose tests.
 */
import { projectPoints } from "../../src/core/project-points.js";
import type { ImagePoint2D, ObjectPoint3D, Pose } from "../../src/core/types.js";
import { CANONICAL_CAMERA_INTRINSICS } from "./canonical-camera-intrinsics.js";
import {
  GROUND_TRUTH_REFINEMENT_POSE,
  SYNTHETIC_OBSERVATION_NOISE_PX,
  WELL_SPREAD_OBJECT_POINTS,
  addDeterministicObservationNoise,
  projectGroundTruthImagePoints,
} from "./refinement-correspondences.js";

export const ESTIMATE_POSE_GROUND_TRUTH_POSE: Pose = GROUND_TRUTH_REFINEMENT_POSE;

export const NON_COPLANAR_OBJECT_POINTS: readonly ObjectPoint3D[] = [
  ...WELL_SPREAD_OBJECT_POINTS,
  [0.08, 0.06, 0.35],
  [-0.06, 0.04, 0.28],
  [0.03, -0.07, 0.32],
  [-0.04, -0.05, 0.27],
];

export const RANSAC_RANDOM_SEED = 42;

export const EXPECTED_RANSAC_INLIER_COUNT = 8;

export const EXPECTED_RANSAC_OUTLIER_INDICES: readonly number[] = [8, 9];

const OUTLIER_IMAGE_OFFSET_PX = 80;

/** Projects object points for the ground-truth estimate pose. */
export function projectEstimatePoseGroundTruthImagePoints(): ImagePoint2D[] {
  return projectPoints(
    NON_COPLANAR_OBJECT_POINTS,
    ESTIMATE_POSE_GROUND_TRUTH_POSE,
    CANONICAL_CAMERA_INTRINSICS,
  );
}

/** Adds deterministic noise for noisy estimatePose tests. */
export function projectNoisyEstimatePoseImagePoints(): ImagePoint2D[] {
  return addDeterministicObservationNoise(projectEstimatePoseGroundTruthImagePoints());
}

/** Creates 8 inlier + 2 outlier correspondences for RANSAC tests. */
export function createOutlierEstimatePoseCorrespondences(): {
  readonly imagePoints: ImagePoint2D[];
  readonly objectPoints: ObjectPoint3D[];
} {
  const cleanImagePoints = projectEstimatePoseGroundTruthImagePoints();
  const imagePoints = [...cleanImagePoints];

  for (const outlierIndex of EXPECTED_RANSAC_OUTLIER_INDICES) {
    const inlierImagePoint = imagePoints[outlierIndex];

    if (inlierImagePoint === undefined) {
      throw new RangeError("Outlier index is out of range for image points.");
    }

    imagePoints[outlierIndex] = [
      inlierImagePoint[0] + OUTLIER_IMAGE_OFFSET_PX,
      inlierImagePoint[1] - OUTLIER_IMAGE_OFFSET_PX,
    ];
  }

  return {
    imagePoints,
    objectPoints: [...NON_COPLANAR_OBJECT_POINTS],
  };
}

export {
  CANONICAL_CAMERA_INTRINSICS,
  SYNTHETIC_OBSERVATION_NOISE_PX,
  projectGroundTruthImagePoints,
};
