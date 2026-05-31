/**
 * Rejects mirrored planar poses whose cuboid face normals point away from the camera.
 */
import { quaternionToRotationMatrix } from "../core/quaternion.js";
import type { ObjectPoint3D, Pose } from "../core/types.js";
import type { EstimatePlanarPoseSuccess } from "../pnp/planar/types.js";
import { computePoseDistanceScore } from "../pnp/planar/pose-distance.js";
import { PRIOR_POSE_REPROJECTION_PREFERENCE_GAP_PX } from "./pose-policy.js";
import type { AprilCubeFaceName, EstimateAprilCubePoseInput } from "./types.js";
import { getUniqueMarkerIds } from "./correspondence-by-marker.js";

/** Face normals with camera-space Z above this value are treated as pointing away. */
const CAMERA_FACING_NORMAL_Z_MAXIMUM = 0;

const FACE_NAME_TO_OBJECT_NORMAL: Readonly<Record<AprilCubeFaceName, ObjectPoint3D>> = {
  right: [1, 0, 0],
  left: [-1, 0, 0],
  bottom: [0, 1, 0],
  top: [0, -1, 0],
  front: [0, 0, 1],
  back: [0, 0, -1],
};

function transformObjectNormalToCameraZ(
  objectNormal: ObjectPoint3D,
  pose: Pose,
): number {
  const rotationMatrix = quaternionToRotationMatrix(pose.rotation);
  return (
    rotationMatrix[6] * objectNormal[0] +
    rotationMatrix[7] * objectNormal[1] +
    rotationMatrix[8] * objectNormal[2]
  );
}

/** Returns false when any visible cuboid face normal points away from the camera. */
export function isPoseFacingCameraForMarkers(
  input: EstimateAprilCubePoseInput,
  markerIds: ReadonlyArray<number>,
  pose: Pose,
): boolean {
  if (input.config.cuboidLayout === undefined) {
    return true;
  }

  for (const markerId of getUniqueMarkerIds(markerIds)) {
    const faceName = input.config.faces[markerId];

    if (faceName === undefined) {
      continue;
    }

    const objectNormal = FACE_NAME_TO_OBJECT_NORMAL[faceName];
    const cameraNormalZ = transformObjectNormalToCameraZ(objectNormal, pose);

    if (cameraNormalZ > CAMERA_FACING_NORMAL_Z_MAXIMUM) {
      return false;
    }
  }

  return true;
}

function selectBestCameraFacingCandidateIndex(
  planarResult: EstimatePlanarPoseSuccess,
  input: EstimateAprilCubePoseInput,
  markerIds: ReadonlyArray<number>,
  previousPose: Pose | undefined,
): number {
  const cameraFacingCandidates = planarResult.candidates
    .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
    .filter(({ candidate }) =>
      isPoseFacingCameraForMarkers(input, markerIds, candidate.pose),
    )
    .sort(
      (leftEntry, rightEntry) =>
        leftEntry.candidate.finalMeanReprojectionErrorPx -
        rightEntry.candidate.finalMeanReprojectionErrorPx,
    );

  if (cameraFacingCandidates.length === 0) {
    return -1;
  }

  const bestReprojectionCandidate = cameraFacingCandidates[0];

  if (bestReprojectionCandidate === undefined) {
    return -1;
  }

  if (previousPose === undefined) {
    return bestReprojectionCandidate.candidateIndex;
  }

  const reprojectionGapPx =
    cameraFacingCandidates[cameraFacingCandidates.length - 1]!.candidate.finalMeanReprojectionErrorPx -
    bestReprojectionCandidate.candidate.finalMeanReprojectionErrorPx;

  if (reprojectionGapPx > PRIOR_POSE_REPROJECTION_PREFERENCE_GAP_PX) {
    return bestReprojectionCandidate.candidateIndex;
  }

  let bestCandidateIndex = bestReprojectionCandidate.candidateIndex;
  let bestPoseDistanceScore = Number.POSITIVE_INFINITY;

  for (const { candidate, candidateIndex } of cameraFacingCandidates) {
    const poseDistanceScore = computePoseDistanceScore(previousPose, candidate.pose);

    if (poseDistanceScore < bestPoseDistanceScore) {
      bestPoseDistanceScore = poseDistanceScore;
      bestCandidateIndex = candidateIndex;
    }
  }

  return bestCandidateIndex;
}

/** Picks the best camera-facing planar candidate, optionally biased toward previousPose. */
export function selectCameraFacingPlanarResult(
  planarResult: EstimatePlanarPoseSuccess,
  input: EstimateAprilCubePoseInput,
  markerIds: ReadonlyArray<number>,
  previousPose?: Pose,
): EstimatePlanarPoseSuccess | null {
  const cameraFacingCandidateIndex = selectBestCameraFacingCandidateIndex(
    planarResult,
    input,
    markerIds,
    previousPose,
  );

  if (cameraFacingCandidateIndex < 0) {
    return null;
  }

  const cameraFacingCandidate = planarResult.candidates[cameraFacingCandidateIndex];

  if (cameraFacingCandidate === undefined) {
    return null;
  }

  return {
    ...planarResult,
    pose: cameraFacingCandidate.pose,
    selectedCandidateIndex: cameraFacingCandidateIndex,
    meanReprojectionErrorPx: cameraFacingCandidate.meanReprojectionErrorPx,
    initialMeanReprojectionErrorPx: cameraFacingCandidate.initialMeanReprojectionErrorPx,
    finalMeanReprojectionErrorPx: cameraFacingCandidate.finalMeanReprojectionErrorPx,
    iterations: cameraFacingCandidate.iterations,
  };
}
