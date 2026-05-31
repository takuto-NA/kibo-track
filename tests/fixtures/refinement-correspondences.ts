/**
 * Synthetic correspondences and perturbations for LM refinement tests.
 */
import { projectPoints } from "../../src/core/project-points.js";
import type { ImagePoint2D, ObjectPoint3D, Pose } from "../../src/core/types.js";
import { rotationVectorToQuaternion } from "../../src/core/rodrigues.js";
import { CANONICAL_CAMERA_INTRINSICS } from "./canonical-camera-intrinsics.js";

export const GROUND_TRUTH_REFINEMENT_POSE: Pose = {
  rotation: [0, 0, 0, 1],
  translation: [0.05, -0.03, 0.2],
};

export const WELL_SPREAD_OBJECT_POINTS: readonly ObjectPoint3D[] = [
  [-0.1, -0.1, 0.2],
  [0.1, -0.1, 0.2],
  [0.1, 0.1, 0.2],
  [-0.1, 0.1, 0.2],
  [0, 0, 0.3],
  [0.05, -0.05, 0.25],
];

export const SMALL_TRANSLATION_PERTURBATION: readonly [number, number, number] = [
  0.02, -0.015, 0.01,
];

export const SMALL_ROTATION_PERTURBATION_RADIANS = 0.05;

export const LARGE_TRANSLATION_PERTURBATION: readonly [number, number, number] = [
  0.2, -0.15, 0.25,
];

export const SYNTHETIC_OBSERVATION_NOISE_PX = 0.5;

const DETERMINISTIC_NOISE_PATTERN: readonly ImagePoint2D[] = [
  [0.4, -0.3],
  [-0.2, 0.5],
  [0.3, 0.2],
  [-0.4, -0.1],
  [0.1, -0.4],
  [-0.3, 0.3],
];

/** Projects object points for the ground-truth refinement pose. */
export function projectGroundTruthImagePoints(): ImagePoint2D[] {
  return projectPoints(
    WELL_SPREAD_OBJECT_POINTS,
    GROUND_TRUTH_REFINEMENT_POSE,
    CANONICAL_CAMERA_INTRINSICS,
  );
}

/** Creates a translation-perturbed initial pose from the ground truth. */
export function createTranslationPerturbedInitialPose(): Pose {
  const [deltaX, deltaY, deltaZ] = SMALL_TRANSLATION_PERTURBATION;
  const [translationX, translationY, translationZ] =
    GROUND_TRUTH_REFINEMENT_POSE.translation;

  return {
    rotation: GROUND_TRUTH_REFINEMENT_POSE.rotation,
    translation: [
      translationX + deltaX,
      translationY + deltaY,
      translationZ + deltaZ,
    ],
  };
}

/** Creates a rotation-perturbed initial pose from the ground truth. */
export function createRotationPerturbedInitialPose(): Pose {
  return {
    rotation: rotationVectorToQuaternion([
      SMALL_ROTATION_PERTURBATION_RADIANS,
      0,
      0,
    ]),
    translation: GROUND_TRUTH_REFINEMENT_POSE.translation,
  };
}

/** Creates a deliberately poor initial pose for inspectable partial recovery tests. */
export function createPoorInitialPose(): Pose {
  const [deltaX, deltaY, deltaZ] = LARGE_TRANSLATION_PERTURBATION;
  const [translationX, translationY, translationZ] =
    GROUND_TRUTH_REFINEMENT_POSE.translation;

  return {
    rotation: rotationVectorToQuaternion([0.35, -0.25, 0.15]),
    translation: [
      translationX + deltaX,
      translationY + deltaY,
      translationZ + deltaZ,
    ],
  };
}

/** Adds deterministic pixel noise to projected image points. */
export function addDeterministicObservationNoise(
  imagePoints: ReadonlyArray<ImagePoint2D>,
): ImagePoint2D[] {
  return imagePoints.map((imagePoint, pointIndex) => {
    const noisePattern = DETERMINISTIC_NOISE_PATTERN[pointIndex];

    if (noisePattern === undefined) {
      throw new RangeError("Deterministic noise pattern is missing for point index.");
    }

    const noiseScale = SYNTHETIC_OBSERVATION_NOISE_PX;
    return [
      imagePoint[0] + noisePattern[0] * noiseScale,
      imagePoint[1] + noisePattern[1] * noiseScale,
    ];
  });
}
