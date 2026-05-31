/**
 * Per-marker reprojection diagnostics and one-pass outlier re-solve for AprilCube.
 */
import { projectPoints } from "../core/project-points.js";
import { reprojectionError } from "../core/reprojection-error.js";
import type { CameraIntrinsics, ImagePoint2D, ObjectPoint3D, Pose } from "../core/types.js";
import { buildMarkerCorrespondenceSlices } from "./correspondence-by-marker.js";
import type { AprilCubeMarkerReprojectionDiagnostic } from "./types.js";

/** Minimum marker count required before outlier re-solve is attempted. */
export const MINIMUM_MARKER_COUNT_FOR_OUTLIER_RESOLVE = 3;

/** Multiplier above the best marker error used to classify an outlier. */
export const MARKER_OUTLIER_MINIMUM_ERROR_MULTIPLIER = 2;

/** Minimum absolute margin above the best marker error for outlier classification (px). */
export const MARKER_OUTLIER_ABSOLUTE_MARGIN_PX = 5;

function computeMinimumMarkerError(
  markerDiagnostics: ReadonlyArray<AprilCubeMarkerReprojectionDiagnostic>,
): number {
  let minimumError = Number.POSITIVE_INFINITY;

  for (const diagnostic of markerDiagnostics) {
    if (diagnostic.meanReprojectionErrorPx < minimumError) {
      minimumError = diagnostic.meanReprojectionErrorPx;
    }
  }

  return minimumError;
}

/** Computes per-marker mean reprojection error for AprilCube correspondences. */
export function computeAprilCubeMarkerReprojectionDiagnostics(
  imagePoints: ReadonlyArray<ImagePoint2D>,
  objectPoints: ReadonlyArray<ObjectPoint3D>,
  markerIds: ReadonlyArray<number>,
  pose: Pose,
  cameraIntrinsics: CameraIntrinsics,
): AprilCubeMarkerReprojectionDiagnostic[] {
  const markerSlices = buildMarkerCorrespondenceSlices(imagePoints, objectPoints, markerIds);

  return markerSlices.map((markerSlice) => {
    const projectedCorners = projectPoints(
      markerSlice.objectPoints,
      pose,
      cameraIntrinsics,
    );
    const errorSummary = reprojectionError(markerSlice.imagePoints, projectedCorners);

    return {
      markerId: markerSlice.markerId,
      meanReprojectionErrorPx: errorSummary.meanErrorPx,
      cornerCount: markerSlice.imagePoints.length,
    };
  });
}

/** Returns marker IDs whose mean reprojection error exceeds the outlier threshold. */
export function selectOutlierMarkerIds(
  markerDiagnostics: ReadonlyArray<AprilCubeMarkerReprojectionDiagnostic>,
): number[] {
  if (markerDiagnostics.length < MINIMUM_MARKER_COUNT_FOR_OUTLIER_RESOLVE) {
    return [];
  }

  const minimumErrorPx = computeMinimumMarkerError(markerDiagnostics);
  const outlierThresholdPx = Math.max(
    minimumErrorPx * MARKER_OUTLIER_MINIMUM_ERROR_MULTIPLIER,
    minimumErrorPx + MARKER_OUTLIER_ABSOLUTE_MARGIN_PX,
  );

  return markerDiagnostics
    .filter((diagnostic) => diagnostic.meanReprojectionErrorPx > outlierThresholdPx)
    .map((diagnostic) => diagnostic.markerId);
}
