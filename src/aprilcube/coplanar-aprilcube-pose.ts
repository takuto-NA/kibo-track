/**
 * Single-face coplanar AprilCube pose estimation path.
 */
import { estimatePlanarPose } from "../pnp/planar/estimate-planar-pose.js";
import { buildPlanarAprilCubePoseSuccess } from "./aprilcube-pose-success.js";
import { countUniqueMarkerIds } from "./correspondence-by-marker.js";
import { resolveSingleFacePlanarMaxReprojectionErrorPx } from "./pose-policy.js";
import { selectCameraFacingPlanarResult } from "./pose-facing-camera.js";
import type {
  AprilCubeCorrespondencesSuccess,
  EstimateAprilCubePoseInput,
  EstimateAprilCubePoseOptions,
  EstimateAprilCubePoseResult,
} from "./types.js";

/** Estimates pose when all correspondences lie on one physical face. */
export function estimateCoplanarAprilCubePose(
  input: EstimateAprilCubePoseInput,
  correspondences: AprilCubeCorrespondencesSuccess,
  options: EstimateAprilCubePoseOptions = {},
): EstimateAprilCubePoseResult {
  const {
    imagePoints,
    objectPoints,
    markerIds,
    cornerIndices,
  } = correspondences;

  const planarResult = estimatePlanarPose(
    {
      imagePoints,
      objectPoints,
      cameraIntrinsics: input.cameraIntrinsics,
    },
    {
      previousPose: options.previousPose,
      maxRefinementIterations: options.maxRefinementIterations,
    },
  );

  if (!planarResult.success) {
    return {
      success: false,
      stage: "poseEstimation",
      reason:
        planarResult.reason === "planarAmbiguous"
          ? "planarAmbiguous"
          : planarResult.reason,
    };
  }

  const cameraFacingPlanarResult = selectCameraFacingPlanarResult(
    planarResult,
    input,
    markerIds,
    options.previousPose,
  );

  if (cameraFacingPlanarResult === null) {
    return {
      success: false,
      stage: "poseEstimation",
      reason: "planarAmbiguous",
    };
  }

  if (
    countUniqueMarkerIds(markerIds) === 1 &&
    cameraFacingPlanarResult.finalMeanReprojectionErrorPx >
      resolveSingleFacePlanarMaxReprojectionErrorPx(options)
  ) {
    return {
      success: false,
      stage: "poseEstimation",
      reason: "reprojectionErrorTooHigh",
    };
  }

  return buildPlanarAprilCubePoseSuccess(
    cameraFacingPlanarResult,
    input,
    markerIds,
    cornerIndices,
    imagePoints,
    objectPoints,
    options,
  );
}
