/**
 * Levenberg-Marquardt pose refinement using numopt-js and pixel-space residuals.
 */
import { levenbergMarquardt } from "numopt-js";
import type { LevenbergMarquardtOptions } from "numopt-js";
import { projectPoints } from "../core/project-points.js";
import { reprojectionError } from "../core/reprojection-error.js";
import type { Pose, ReprojectionErrorSummary } from "../core/types.js";
import {
  DEFAULT_LM_JACOBIAN_STEP,
  DEFAULT_LM_LAMBDA_INITIAL,
  DEFAULT_LM_MAX_ITERATIONS,
  DEFAULT_LM_TOLERANCE_GRADIENT,
  DEFAULT_LM_TOLERANCE_RESIDUAL,
  DEFAULT_LM_TOLERANCE_STEP,
} from "./constants.js";
import { computeImprovementRatio } from "./improvement-ratio.js";
import { poseToParameterVector, parameterVectorToPose } from "./pose-parameters.js";
import { buildRefinementResidualFunction } from "./refine-pose-residuals.js";
import type {
  RefinePoseLMInput,
  RefinePoseLMOptions,
  RefinePoseLMResult,
  RefinePoseLMSuccess,
} from "./types.js";
import { validateRefinePoseLMInput } from "./validate-refine-input.js";

function resolveLevenbergMarquardtOptions(
  options: RefinePoseLMOptions,
): LevenbergMarquardtOptions {
  return {
    useNumericJacobian: true,
    maxIterations: options.maxIterations ?? DEFAULT_LM_MAX_ITERATIONS,
    jacobianStep: options.jacobianStep ?? DEFAULT_LM_JACOBIAN_STEP,
    tolGradient: options.tolGradient ?? DEFAULT_LM_TOLERANCE_GRADIENT,
    tolStep: options.tolStep ?? DEFAULT_LM_TOLERANCE_STEP,
    tolResidual: options.tolResidual ?? DEFAULT_LM_TOLERANCE_RESIDUAL,
    lambdaInitial: options.lambdaInitial ?? DEFAULT_LM_LAMBDA_INITIAL,
  };
}

function computeReprojectionSummaryForPose(
  input: RefinePoseLMInput,
  pose: Pose,
): ReprojectionErrorSummary {
  const projectedImagePoints = projectPoints(
    input.objectPoints,
    pose,
    input.cameraIntrinsics,
  );

  return reprojectionError(input.imagePoints, projectedImagePoints);
}

function buildRefinePoseLMSuccess(
  input: RefinePoseLMInput,
  optimizedParameters: Float64Array,
  iterations: number,
  converged: boolean,
  finalResidualNorm: number,
): RefinePoseLMSuccess {
  const refinedPose = parameterVectorToPose(optimizedParameters);
  const initialReprojectionError = computeReprojectionSummaryForPose(
    input,
    input.initialPose,
  );
  const finalReprojectionError = computeReprojectionSummaryForPose(input, refinedPose);

  const initialMeanReprojectionErrorPx = initialReprojectionError.meanErrorPx;
  const finalMeanReprojectionErrorPx = finalReprojectionError.meanErrorPx;

  return {
    success: true,
    pose: refinedPose,
    initialMeanReprojectionErrorPx,
    finalMeanReprojectionErrorPx,
    improvementRatio: computeImprovementRatio(
      initialMeanReprojectionErrorPx,
      finalMeanReprojectionErrorPx,
    ),
    initialReprojectionError,
    finalReprojectionError,
    iterations,
    converged,
    finalResidualNorm,
  };
}

/** Refines an initial cameraFromObject pose using pixel-space Levenberg-Marquardt. */
export function refinePoseLM(
  input: RefinePoseLMInput,
  options: RefinePoseLMOptions = {},
): RefinePoseLMResult {
  const validationFailureReason = validateRefinePoseLMInput(input);
  if (validationFailureReason !== null) {
    return {
      success: false,
      reason: validationFailureReason,
    };
  }

  const initialParameters = poseToParameterVector(input.initialPose);
  const residualFunction = buildRefinementResidualFunction(
    input.objectPoints,
    input.imagePoints,
    input.cameraIntrinsics,
  );

  const optimizationResult = levenbergMarquardt(
    initialParameters,
    residualFunction,
    resolveLevenbergMarquardtOptions(options),
  );

  return buildRefinePoseLMSuccess(
    input,
    optimizationResult.finalParameters,
    optimizationResult.iterations,
    optimizationResult.converged,
    optimizationResult.finalResidualNorm,
  );
}
