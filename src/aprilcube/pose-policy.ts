/**
 * AprilCube pose acceptance thresholds and option resolution helpers.
 */
import { DEFAULT_RANSAC_REPROJECTION_ERROR_THRESHOLD_PX } from "../pnp/constants.js";
import type { EstimateAprilCubePoseOptions } from "./types.js";

/** Single-face planar poses above this residual are too weak for AprilCube overlay. */
export const DEFAULT_SINGLE_FACE_PLANAR_MAX_REPROJECTION_ERROR_PX = 2;

/** Prefer best reprojection over temporal prior when px gap exceeds this value. */
export const PRIOR_POSE_REPROJECTION_PREFERENCE_GAP_PX = 0.25;

/** Resolves the single-face planar rejection threshold from options. */
export function resolveSingleFacePlanarMaxReprojectionErrorPx(
  options: EstimateAprilCubePoseOptions,
): number {
  return (
    options.reprojectionErrorThresholdPx ??
    DEFAULT_SINGLE_FACE_PLANAR_MAX_REPROJECTION_ERROR_PX
  );
}

/** Resolves the multi-face fallback and inlier threshold from options. */
export function resolveMultiFaceReprojectionErrorThresholdPx(
  options: EstimateAprilCubePoseOptions,
): number {
  return (
    options.reprojectionErrorThresholdPx ??
    DEFAULT_RANSAC_REPROJECTION_ERROR_THRESHOLD_PX
  );
}
