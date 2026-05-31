/**
 * Estimates AprilCube pose with multi-face EPnP, planar single-face, and outlier re-solve.
 */
import { areObjectPointsCoplanar } from "../pnp/coplanarity.js";
import { estimatePlanarPose } from "../pnp/planar/estimate-planar-pose.js";
import { buildPlanarAprilCubePoseSuccess } from "./aprilcube-pose-success.js";
import { buildAprilCubeCorrespondences } from "./build-correspondences.js";
import { estimateMultiFaceAprilCubePose } from "./estimate-aprilcube-pose-resolve.js";
import { selectCameraFacingPlanarResult } from "./pose-facing-camera.js";
import type {
  EstimateAprilCubePoseInput,
  EstimateAprilCubePoseOptions,
  EstimateAprilCubePoseResult,
} from "./types.js";

/** Single-face planar poses above this residual are too weak for AprilCube overlay. */
const DEFAULT_SINGLE_FACE_PLANAR_MAX_REPROJECTION_ERROR_PX = 2;

function countUniqueMarkerIds(markerIds: ReadonlyArray<number>): number {
  return new Set(markerIds).size;
}

function resolveSingleFacePlanarMaxReprojectionErrorPx(
  options: EstimateAprilCubePoseOptions,
): number {
  return (
    options.reprojectionErrorThresholdPx ??
    DEFAULT_SINGLE_FACE_PLANAR_MAX_REPROJECTION_ERROR_PX
  );
}

/** Estimates cameraFromObject pose from detected AprilCube marker corners. */
export function estimateAprilCubePose(
  input: EstimateAprilCubePoseInput,
  options: EstimateAprilCubePoseOptions = {},
): EstimateAprilCubePoseResult {
  const correspondenceResult = buildAprilCubeCorrespondences(
    input.markers,
    input.config,
  );

  if (!correspondenceResult.success) {
    return {
      success: false,
      stage: "adapter",
      reason: correspondenceResult.reason,
    };
  }

  const {
    imagePoints,
    objectPoints,
    markerIds,
    cornerIndices,
  } = correspondenceResult;

  const objectPointsAreCoplanar = areObjectPointsCoplanar(objectPoints);

  if (objectPointsAreCoplanar) {
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

  return estimateMultiFaceAprilCubePose(
    input,
    imagePoints,
    objectPoints,
    markerIds,
    cornerIndices,
    options,
    "multiFace",
    estimateAprilCubePose,
  );
}
