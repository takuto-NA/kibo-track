/**
 * EPnP initial pose solver boundary returning Result-style failures.
 */
import type { Pose, PoseEstimationFailureReason } from "../core/types.js";
import { solveEpnpInitialPose } from "./epnp/epnp-solver.js";
import type { EstimatePoseInput } from "./estimate-pose-types.js";
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

/** Solves an initial cameraFromObject pose using EPnP. */
export function solvePnPInitial(input: EstimatePoseInput): SolvePnPInitialResult {
  const validationReason = validateEstimatePoseInput(input);

  if (validationReason !== null) {
    return {
      success: false,
      reason: validationReason,
    };
  }

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
