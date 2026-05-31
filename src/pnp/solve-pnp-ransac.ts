/**
 * Point-level RANSAC wrapper around EPnP initial pose and LM refinement.
 */
import type { Pose } from "../core/types.js";
import { computeMeasurementConfidence } from "./confidence.js";
import {
  DEFAULT_RANSAC_DESIRED_CONFIDENCE,
  DEFAULT_RANSAC_MAX_ITERATIONS,
  DEFAULT_RANSAC_MINIMUM_INLIER_COUNT,
  DEFAULT_RANSAC_REPROJECTION_ERROR_THRESHOLD_PX,
  RANSAC_MINIMAL_SAMPLE_SIZE,
  RANSAC_REFINED_MODEL_ERROR_MULTIPLIER,
} from "./constants.js";
import type { EstimatePoseInput, EstimatePoseOptions } from "./estimate-pose-types.js";
import {
  classifyCorrespondenceInliers,
  selectCorrespondencesByIndices,
} from "./inlier-classification.js";
import { refinePoseLM } from "./refine-pose-lm.js";
import {
  computeAdaptiveRansacIterationCount,
  createRandomNumberGenerator,
} from "./ransac-random.js";
import { solvePnPInitial } from "./solve-pnp-initial.js";

export interface SolvePnPRansacSuccess {
  readonly success: true;
  readonly pose: Pose;
  readonly inlierIndices: number[];
  readonly outlierIndices: number[];
  readonly numInliers: number;
  readonly inlierRatio: number;
  readonly meanReprojectionErrorPx: number;
  readonly confidence: number;
  readonly initialMeanReprojectionErrorPx: number;
  readonly finalMeanReprojectionErrorPx: number;
  readonly iterations: number;
}

export interface SolvePnPRansacFailure {
  readonly success: false;
  readonly reason: "notEnoughInliers" | "degenerateConfiguration" | "invalidInput";
}

export type SolvePnPRansacResult = SolvePnPRansacSuccess | SolvePnPRansacFailure;

export interface SolvePnPRansacParameters {
  readonly maxIterations: number;
  readonly reprojectionErrorThresholdPx: number;
  readonly desiredConfidence: number;
  readonly minimumInlierCount: number;
  readonly randomSeed?: number;
  readonly maxRefinementIterations?: number;
}

interface RansacCandidateModel {
  readonly pose: Pose;
  readonly inlierIndices: number[];
  readonly outlierIndices: number[];
  readonly numInliers: number;
  readonly inlierRatio: number;
  readonly meanReprojectionErrorPx: number;
  readonly initialMeanReprojectionErrorPx: number;
  readonly finalMeanReprojectionErrorPx: number;
  readonly iterations: number;
}

function resolveRansacParameters(options: EstimatePoseOptions): SolvePnPRansacParameters {
  return {
    maxIterations: options.maxRansacIterations ?? DEFAULT_RANSAC_MAX_ITERATIONS,
    reprojectionErrorThresholdPx:
      options.reprojectionErrorThresholdPx ?? DEFAULT_RANSAC_REPROJECTION_ERROR_THRESHOLD_PX,
    desiredConfidence: options.desiredRansacConfidence ?? DEFAULT_RANSAC_DESIRED_CONFIDENCE,
    minimumInlierCount: options.minimumInlierCount ?? DEFAULT_RANSAC_MINIMUM_INLIER_COUNT,
    randomSeed: options.randomSeed,
    maxRefinementIterations: options.maxRefinementIterations,
  };
}

function buildSampleInput(
  input: EstimatePoseInput,
  sampleIndices: ReadonlyArray<number>,
): EstimatePoseInput {
  return {
    imagePoints: selectCorrespondencesByIndices(input.imagePoints, sampleIndices),
    objectPoints: selectCorrespondencesByIndices(input.objectPoints, sampleIndices),
    cameraIntrinsics: input.cameraIntrinsics,
  };
}

function refineCandidatePose(
  input: EstimatePoseInput,
  initialPose: Pose,
  inlierIndices: ReadonlyArray<number>,
  reprojectionErrorThresholdPx: number,
  maxRefinementIterations?: number,
): RansacCandidateModel | null {
  const inlierImagePoints = selectCorrespondencesByIndices(input.imagePoints, inlierIndices);
  const inlierObjectPoints = selectCorrespondencesByIndices(input.objectPoints, inlierIndices);

  const refinementResult = refinePoseLM(
    {
      imagePoints: inlierImagePoints,
      objectPoints: inlierObjectPoints,
      cameraIntrinsics: input.cameraIntrinsics,
      initialPose,
    },
    {
      maxIterations: maxRefinementIterations,
    },
  );

  if (!refinementResult.success) {
    return null;
  }

  const classification = classifyCorrespondenceInliers(
    input.imagePoints,
    input.objectPoints,
    refinementResult.pose,
    input.cameraIntrinsics,
    reprojectionErrorThresholdPx,
  );

  return {
    pose: refinementResult.pose,
    inlierIndices: classification.inlierIndices,
    outlierIndices: classification.outlierIndices,
    numInliers: classification.numInliers,
    inlierRatio: classification.inlierRatio,
    meanReprojectionErrorPx: refinementResult.finalMeanReprojectionErrorPx,
    initialMeanReprojectionErrorPx: refinementResult.initialMeanReprojectionErrorPx,
    finalMeanReprojectionErrorPx: refinementResult.finalMeanReprojectionErrorPx,
    iterations: refinementResult.iterations,
  };
}

/** Runs point-level RANSAC with EPnP hypotheses and LM refinement on inliers. */
export function solvePnPRansac(
  input: EstimatePoseInput,
  options: EstimatePoseOptions = {},
): SolvePnPRansacResult {
  const ransacParameters = resolveRansacParameters(options);
  const correspondenceCount = input.imagePoints.length;

  if (correspondenceCount < RANSAC_MINIMAL_SAMPLE_SIZE) {
    return {
      success: false,
      reason: "invalidInput",
    };
  }

  const randomNumberGenerator = createRandomNumberGenerator(ransacParameters.randomSeed);

  let bestCandidate: RansacCandidateModel | null = null;
  let iterationCount = 0;
  let adaptiveIterationCap = ransacParameters.maxIterations;

  while (iterationCount < adaptiveIterationCap) {
    iterationCount += 1;

    const sampleIndices = randomNumberGenerator.sampleUniqueIndices(
      correspondenceCount,
      RANSAC_MINIMAL_SAMPLE_SIZE,
    );
    const sampleInput = buildSampleInput(input, sampleIndices);
    const initialPoseResult = solvePnPInitial(sampleInput);

    if (!initialPoseResult.success) {
      continue;
    }

    const provisionalClassification = classifyCorrespondenceInliers(
      input.imagePoints,
      input.objectPoints,
      initialPoseResult.pose,
      input.cameraIntrinsics,
      ransacParameters.reprojectionErrorThresholdPx,
    );

    if (provisionalClassification.numInliers < ransacParameters.minimumInlierCount) {
      adaptiveIterationCap = computeAdaptiveRansacIterationCount(
        provisionalClassification.inlierRatio,
        RANSAC_MINIMAL_SAMPLE_SIZE,
        ransacParameters.desiredConfidence,
        ransacParameters.maxIterations,
      );
      continue;
    }

    const refinedCandidate = refineCandidatePose(
      input,
      initialPoseResult.pose,
      provisionalClassification.inlierIndices,
      ransacParameters.reprojectionErrorThresholdPx,
      ransacParameters.maxRefinementIterations,
    );

    if (refinedCandidate === null) {
      continue;
    }

    if (
      refinedCandidate.numInliers < ransacParameters.minimumInlierCount ||
      refinedCandidate.meanReprojectionErrorPx >
        ransacParameters.reprojectionErrorThresholdPx * RANSAC_REFINED_MODEL_ERROR_MULTIPLIER
    ) {
      adaptiveIterationCap = computeAdaptiveRansacIterationCount(
        refinedCandidate.inlierRatio,
        RANSAC_MINIMAL_SAMPLE_SIZE,
        ransacParameters.desiredConfidence,
        ransacParameters.maxIterations,
      );
      continue;
    }

    if (
      bestCandidate === null ||
      refinedCandidate.numInliers > bestCandidate.numInliers ||
      (
        refinedCandidate.numInliers === bestCandidate.numInliers &&
        refinedCandidate.finalMeanReprojectionErrorPx < bestCandidate.finalMeanReprojectionErrorPx
      )
    ) {
      bestCandidate = refinedCandidate;
    }

    adaptiveIterationCap = computeAdaptiveRansacIterationCount(
      refinedCandidate.inlierRatio,
      RANSAC_MINIMAL_SAMPLE_SIZE,
      ransacParameters.desiredConfidence,
      ransacParameters.maxIterations,
    );
  }

  if (bestCandidate === null || bestCandidate.numInliers < ransacParameters.minimumInlierCount) {
    return {
      success: false,
      reason: "notEnoughInliers",
    };
  }

  const confidence = computeMeasurementConfidence({
    numInliers: bestCandidate.numInliers,
    totalPointCount: correspondenceCount,
    meanReprojectionErrorPx: bestCandidate.finalMeanReprojectionErrorPx,
    reprojectionErrorThresholdPx: ransacParameters.reprojectionErrorThresholdPx,
  });

  return {
    success: true,
    pose: bestCandidate.pose,
    inlierIndices: bestCandidate.inlierIndices,
    outlierIndices: bestCandidate.outlierIndices,
    numInliers: bestCandidate.numInliers,
    inlierRatio: bestCandidate.inlierRatio,
    meanReprojectionErrorPx: bestCandidate.finalMeanReprojectionErrorPx,
    confidence,
    initialMeanReprojectionErrorPx: bestCandidate.initialMeanReprojectionErrorPx,
    finalMeanReprojectionErrorPx: bestCandidate.finalMeanReprojectionErrorPx,
    iterations: bestCandidate.iterations,
  };
}
