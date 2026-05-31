/**
 * Public estimatePose entrypoint: EPnP initial pose, LM refinement, optional RANSAC.
 */
import { computeMeasurementConfidence } from "./confidence.js";
import {
  DEFAULT_RANSAC_REPROJECTION_ERROR_THRESHOLD_PX,
  MINIMUM_ESTIMATE_POSE_CORRESPONDENCE_COUNT,
} from "./constants.js";
import type {
  EstimatePoseInput,
  EstimatePoseOptions,
  EstimatePoseResult,
} from "./estimate-pose-types.js";
import {
  classifyCorrespondenceInliers,
} from "./inlier-classification.js";
import { refinePoseLM } from "./refine-pose-lm.js";
import { solvePnPRansac } from "./solve-pnp-ransac.js";
import { solvePnPInitial } from "./solve-pnp-initial.js";
import { validateEstimatePoseInput } from "./validate-estimate-input.js";

function shouldUseRansac(
  input: EstimatePoseInput,
  options: EstimatePoseOptions,
): boolean {
  if (options.enableRansac === false) {
    return false;
  }

  return input.imagePoints.length > MINIMUM_ESTIMATE_POSE_CORRESPONDENCE_COUNT;
}

function estimatePoseWithoutRansac(
  input: EstimatePoseInput,
  options: EstimatePoseOptions,
): EstimatePoseResult {
  const initialPoseResult = solvePnPInitial(input);

  if (!initialPoseResult.success) {
    return {
      success: false,
      reason: initialPoseResult.reason,
    };
  }

  const refinementResult = refinePoseLM(
    {
      imagePoints: input.imagePoints,
      objectPoints: input.objectPoints,
      cameraIntrinsics: input.cameraIntrinsics,
      initialPose: initialPoseResult.pose,
    },
    {
      maxIterations: options.maxRefinementIterations,
    },
  );

  if (!refinementResult.success) {
    return {
      success: false,
      reason: "degenerateConfiguration",
    };
  }

  const reprojectionErrorThresholdPx =
    options.reprojectionErrorThresholdPx ?? DEFAULT_RANSAC_REPROJECTION_ERROR_THRESHOLD_PX;

  const classification = classifyCorrespondenceInliers(
    input.imagePoints,
    input.objectPoints,
    refinementResult.pose,
    input.cameraIntrinsics,
    reprojectionErrorThresholdPx,
  );

  const confidence = computeMeasurementConfidence({
    numInliers: classification.numInliers,
    totalPointCount: input.imagePoints.length,
    meanReprojectionErrorPx: refinementResult.finalMeanReprojectionErrorPx,
    reprojectionErrorThresholdPx,
  });

  return {
    success: true,
    pose: refinementResult.pose,
    inlierIndices: classification.inlierIndices,
    outlierIndices: classification.outlierIndices,
    numInliers: classification.numInliers,
    inlierRatio: classification.inlierRatio,
    meanReprojectionErrorPx: refinementResult.finalMeanReprojectionErrorPx,
    confidence,
    initialMeanReprojectionErrorPx: refinementResult.initialMeanReprojectionErrorPx,
    finalMeanReprojectionErrorPx: refinementResult.finalMeanReprojectionErrorPx,
    iterations: refinementResult.iterations,
  };
}

/** Estimates cameraFromObject pose from 2D-3D correspondences without an initial pose. */
export function estimatePose(
  input: EstimatePoseInput,
  options: EstimatePoseOptions = {},
): EstimatePoseResult {
  const validationReason = validateEstimatePoseInput(input);

  if (validationReason !== null) {
    return {
      success: false,
      reason: validationReason,
    };
  }

  if (!shouldUseRansac(input, options)) {
    return estimatePoseWithoutRansac(input, options);
  }

  const ransacResult = solvePnPRansac(input, options);

  if (!ransacResult.success) {
    return {
      success: false,
      reason: ransacResult.reason,
    };
  }

  return {
    success: true,
    pose: ransacResult.pose,
    inlierIndices: ransacResult.inlierIndices,
    outlierIndices: ransacResult.outlierIndices,
    numInliers: ransacResult.numInliers,
    inlierRatio: ransacResult.inlierRatio,
    meanReprojectionErrorPx: ransacResult.meanReprojectionErrorPx,
    confidence: ransacResult.confidence,
    initialMeanReprojectionErrorPx: ransacResult.initialMeanReprojectionErrorPx,
    finalMeanReprojectionErrorPx: ransacResult.finalMeanReprojectionErrorPx,
    iterations: ransacResult.iterations,
  };
}
