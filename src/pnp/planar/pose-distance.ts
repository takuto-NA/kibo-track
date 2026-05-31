/**
 * Pose distance metrics for planar candidate disambiguation.
 */
import { quaternionToRotationVector } from "../../core/rodrigues.js";
import type { Pose } from "../../core/types.js";

/** Computes a combined translation and rotation distance between two poses. */
export function computePoseDistanceScore(referencePose: Pose, candidatePose: Pose): number {
  const translationDeltaX = candidatePose.translation[0] - referencePose.translation[0];
  const translationDeltaY = candidatePose.translation[1] - referencePose.translation[1];
  const translationDeltaZ = candidatePose.translation[2] - referencePose.translation[2];
  const translationDistance = Math.hypot(translationDeltaX, translationDeltaY, translationDeltaZ);

  const referenceRotationVector = quaternionToRotationVector(referencePose.rotation);
  const candidateRotationVector = quaternionToRotationVector(candidatePose.rotation);
  const rotationDistance = Math.hypot(
    candidateRotationVector[0] - referenceRotationVector[0],
    candidateRotationVector[1] - referenceRotationVector[1],
    candidateRotationVector[2] - referenceRotationVector[2],
  );

  return translationDistance + rotationDistance;
}

/** Computes ambiguity score from best and second-best candidate reprojection errors. */
export function computePlanarAmbiguityScore(
  bestReprojectionErrorPx: number,
  secondBestReprojectionErrorPx: number | null,
): number {
  if (secondBestReprojectionErrorPx === null) {
    return Number.POSITIVE_INFINITY;
  }

  return secondBestReprojectionErrorPx - bestReprojectionErrorPx;
}
