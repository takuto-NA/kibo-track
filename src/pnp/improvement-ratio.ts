/**
 * Computes inspectable improvement ratio from reprojection error metrics.
 */
import { ZERO_INITIAL_MEAN_ERROR_EPSILON_PX } from "./constants.js";

/** Computes `(initialMean - finalMean) / initialMean` with zero-initial handling. */
export function computeImprovementRatio(
  initialMeanReprojectionErrorPx: number,
  finalMeanReprojectionErrorPx: number,
): number {
  if (initialMeanReprojectionErrorPx <= ZERO_INITIAL_MEAN_ERROR_EPSILON_PX) {
    if (finalMeanReprojectionErrorPx <= ZERO_INITIAL_MEAN_ERROR_EPSILON_PX) {
      return 1;
    }

    return 0;
  }

  return (
    (initialMeanReprojectionErrorPx - finalMeanReprojectionErrorPx) /
    initialMeanReprojectionErrorPx
  );
}
