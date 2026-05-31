/**
 * Heuristic measurement confidence derived from inlier coverage and reprojection quality.
 */
import {
  CONFIDENCE_INLIER_COVERAGE_WEIGHT,
  CONFIDENCE_MAXIMUM_REPROJECTION_ERROR_PX,
  CONFIDENCE_MINIMUM_INLIER_COUNT,
  CONFIDENCE_MINIMUM_INLIER_WEIGHT,
  CONFIDENCE_REPROJECTION_QUALITY_WEIGHT,
} from "./constants.js";

export interface ConfidenceInputs {
  readonly numInliers: number;
  readonly totalPointCount: number;
  readonly meanReprojectionErrorPx: number;
  readonly reprojectionErrorThresholdPx: number;
}

/** Computes a 0..1 heuristic confidence score (not a probability). */
export function computeMeasurementConfidence(inputs: ConfidenceInputs): number {
  if (inputs.totalPointCount <= 0) {
    return 0;
  }

  if (inputs.numInliers < CONFIDENCE_MINIMUM_INLIER_COUNT) {
    return 0;
  }

  const inlierRatio = inputs.numInliers / inputs.totalPointCount;
  const inlierCoverageTerm = clampUnitInterval(inlierRatio);

  const errorScale = Math.max(
    inputs.reprojectionErrorThresholdPx,
    CONFIDENCE_MAXIMUM_REPROJECTION_ERROR_PX,
  );
  const normalizedError = inputs.meanReprojectionErrorPx / errorScale;
  const reprojectionQualityTerm = clampUnitInterval(1 - normalizedError);

  const minimumInlierTerm = clampUnitInterval(
    inputs.numInliers / CONFIDENCE_MINIMUM_INLIER_COUNT,
  );

  const confidence =
    inlierCoverageTerm * CONFIDENCE_INLIER_COVERAGE_WEIGHT +
    reprojectionQualityTerm * CONFIDENCE_REPROJECTION_QUALITY_WEIGHT +
    minimumInlierTerm * CONFIDENCE_MINIMUM_INLIER_WEIGHT;

  return clampUnitInterval(confidence);
}

function clampUnitInterval(value: number): number {
  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}
