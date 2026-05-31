/**
 * EPnP initial pose solver boundary returning Result-style failures.
 */
import type { Pose, PoseEstimationFailureReason } from "../core/types.js";
import { solveEpnpInitialPose } from "./epnp/epnp-solver.js";
import type { EstimatePoseInput } from "./estimate-pose-types.js";
import { solvePnPDlt } from "./solve-pnp-dlt.js";
import { validateEstimatePoseInput } from "./validate-estimate-input.js";

export interface SolvePnPInitialSuccess {
  readonly success: true;
  readonly pose: Pose;
  readonly meanReprojectionErrorPx: number;
}

export interface SolvePnPInitialFailure {
  readonly success: false;
  readonly reason: PoseEstimationFailureReason;
}

export type SolvePnPInitialResult = SolvePnPInitialSuccess | SolvePnPInitialFailure;

function solveEpnpInitial(input: EstimatePoseInput): SolvePnPInitialResult {
  try {
    const epnpResult = solveEpnpInitialPose({
      objectPoints: input.objectPoints,
      imagePoints: input.imagePoints,
      cameraIntrinsics: input.cameraIntrinsics,
    });

    return {
      success: true,
      pose: epnpResult.pose,
      meanReprojectionErrorPx: epnpResult.meanReprojectionErrorPx,
    };
  } catch (error) {
    if (!(error instanceof RangeError)) {
      throw error;
    }

    return {
      success: false,
      reason: "degenerateConfiguration",
    };
  }
}

/** Solves an initial cameraFromObject pose using the best available cold-start candidate. */
export function solvePnPInitial(input: EstimatePoseInput): SolvePnPInitialResult {
  const validationReason = validateEstimatePoseInput(input);

  if (validationReason !== null) {
    return {
      success: false,
      reason: validationReason,
    };
  }

  const epnpResult = solveEpnpInitial(input);
  const dltResult = solvePnPDlt(input);

  if (!epnpResult.success) {
    return dltResult;
  }

  if (
    dltResult.success &&
    dltResult.meanReprojectionErrorPx < epnpResult.meanReprojectionErrorPx
  ) {
    return {
      success: true,
      pose: dltResult.pose,
      meanReprojectionErrorPx: dltResult.meanReprojectionErrorPx,
    };
  }

  return epnpResult;
}
