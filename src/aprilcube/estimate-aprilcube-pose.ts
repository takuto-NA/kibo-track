/**
 * Estimates AprilCube pose with multi-face EPnP, planar single-face, and outlier re-solve.
 */
import { areObjectPointsCoplanar } from "../pnp/coplanarity.js";
import { buildAprilCubeCorrespondences } from "./build-correspondences.js";
import { estimateCoplanarAprilCubePose } from "./coplanar-aprilcube-pose.js";
import { estimateMultiFaceAprilCubePose } from "./estimate-aprilcube-pose-resolve.js";
import type {
  AprilCubeCorrespondencesSuccess,
  EstimateAprilCubePoseInput,
  EstimateAprilCubePoseOptions,
  EstimateAprilCubePoseResult,
} from "./types.js";

/** Estimates pose from pre-built correspondences (coplanar or multi-face path). */
export function estimateAprilCubePoseFromCorrespondences(
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

  if (areObjectPointsCoplanar(objectPoints)) {
    return estimateCoplanarAprilCubePose(input, correspondences, options);
  }

  return estimateMultiFaceAprilCubePose(
    input,
    imagePoints,
    objectPoints,
    markerIds,
    cornerIndices,
    options,
    "multiFace",
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

  return estimateAprilCubePoseFromCorrespondences(input, correspondenceResult, options);
}
