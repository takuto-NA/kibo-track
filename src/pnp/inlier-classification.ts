/**
 * Classifies correspondences as inliers or outliers by pixel reprojection error.
 */
import { projectPoints } from "../core/project-points.js";
import { reprojectionError } from "../core/reprojection-error.js";
import type { CameraIntrinsics, ImagePoint2D, ObjectPoint3D, Pose } from "../core/types.js";

export interface InlierClassificationResult {
  readonly inlierIndices: number[];
  readonly outlierIndices: number[];
  readonly numInliers: number;
  readonly inlierRatio: number;
  readonly meanReprojectionErrorPx: number;
}

/** Splits correspondences by a pixel reprojection threshold for one pose. */
export function classifyCorrespondenceInliers(
  imagePoints: ReadonlyArray<ImagePoint2D>,
  objectPoints: ReadonlyArray<ObjectPoint3D>,
  pose: Pose,
  cameraIntrinsics: CameraIntrinsics,
  reprojectionErrorThresholdPx: number,
): InlierClassificationResult {
  const projectedImagePoints = projectPoints(objectPoints, pose, cameraIntrinsics);
  const errorSummary = reprojectionError(imagePoints, projectedImagePoints);

  const inlierIndices: number[] = [];
  const outlierIndices: number[] = [];

  for (let pointIndex = 0; pointIndex < errorSummary.perPointErrorsPx.length; pointIndex += 1) {
    const pointErrorPx = errorSummary.perPointErrorsPx[pointIndex] ?? Number.POSITIVE_INFINITY;

    if (pointErrorPx <= reprojectionErrorThresholdPx) {
      inlierIndices.push(pointIndex);
      continue;
    }

    outlierIndices.push(pointIndex);
  }

  const totalPointCount = imagePoints.length;
  const inlierRatio = totalPointCount === 0 ? 0 : inlierIndices.length / totalPointCount;

  return {
    inlierIndices,
    outlierIndices,
    numInliers: inlierIndices.length,
    inlierRatio,
    meanReprojectionErrorPx: errorSummary.meanErrorPx,
  };
}

/** Selects correspondences by index list. */
export function selectCorrespondencesByIndices<T>(
  values: ReadonlyArray<T>,
  indices: ReadonlyArray<number>,
): T[] {
  return indices.map((index) => {
    const value = values[index];

    if (value === undefined) {
      throw new RangeError("Correspondence index is out of range.");
    }

    return value;
  });
}
