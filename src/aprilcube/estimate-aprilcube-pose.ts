/**
 * Public AprilCube pose estimation entrypoint.
 */
import { buildAprilCubeCorrespondences } from "./build-correspondences.js";
import { routeAprilCubePoseFromCorrespondences } from "./aprilcube-pose-routing.js";
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
  return routeAprilCubePoseFromCorrespondences(input, correspondences, options);
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
