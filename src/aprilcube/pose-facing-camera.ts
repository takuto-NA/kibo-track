/**
 * Rejects mirrored planar poses whose cuboid face normals point away from the camera.
 */
import { quaternionToRotationMatrix } from "../core/quaternion.js";
import type { ObjectPoint3D, Pose } from "../core/types.js";
import { estimatePlanarPose } from "../pnp/planar/estimate-planar-pose.js";
import type { AprilCubeFaceName, EstimateAprilCubePoseInput } from "./types.js";
import { getUniqueMarkerIds } from "./correspondence-by-marker.js";

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

/** Picks the first planar candidate whose face normals face the camera. */
export function selectCameraFacingPlanarResult(
  planarResult: Extract<ReturnType<typeof estimatePlanarPose>, { success: true }>,
  input: EstimateAprilCubePoseInput,
  markerIds: ReadonlyArray<number>,
): Extract<ReturnType<typeof estimatePlanarPose>, { success: true }> | null {
  const cameraFacingCandidateIndex = planarResult.candidates.findIndex((candidate) =>
    isPoseFacingCameraForMarkers(input, markerIds, candidate.pose),
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
