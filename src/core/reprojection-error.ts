/**
 * Pixel-space reprojection error computation for pose quality metrics.
 */
import type { ImagePoint2D, ReprojectionErrorSummary } from "./types.js";

function computeEuclideanDistancePx(
  firstPoint: ImagePoint2D,
  secondPoint: ImagePoint2D,
): number {
  const deltaU = firstPoint[0] - secondPoint[0];
  const deltaV = firstPoint[1] - secondPoint[1];
  return Math.hypot(deltaU, deltaV);
}

/** Computes per-point and mean reprojection error in pixel space. */
export function reprojectionError(
  observedImagePoints: ReadonlyArray<ImagePoint2D>,
  projectedImagePoints: ReadonlyArray<ImagePoint2D>,
): ReprojectionErrorSummary {
  if (observedImagePoints.length !== projectedImagePoints.length) {
    throw new RangeError(
      "Observed and projected image point arrays must have the same length.",
    );
  }

  if (observedImagePoints.length === 0) {
    return {
      perPointErrorsPx: [],
      meanErrorPx: 0,
    };
  }

  const perPointErrorsPx = observedImagePoints.map((observedPoint, pointIndex) => {
    const projectedPoint = projectedImagePoints[pointIndex];

    if (projectedPoint === undefined) {
      throw new RangeError("Projected image point is missing for the observed point.");
    }

    return computeEuclideanDistancePx(observedPoint, projectedPoint);
  });

  const totalErrorPx = perPointErrorsPx.reduce(
    (accumulatedError, currentError) => accumulatedError + currentError,
    0,
  );
  const meanErrorPx = totalErrorPx / perPointErrorsPx.length;

  return {
    perPointErrorsPx,
    meanErrorPx,
  };
}

/** Computes mean reprojection error in pixel space. */
export function meanReprojectionErrorPx(
  observedImagePoints: ReadonlyArray<ImagePoint2D>,
  projectedImagePoints: ReadonlyArray<ImagePoint2D>,
): number {
  return reprojectionError(observedImagePoints, projectedImagePoints).meanErrorPx;
}
