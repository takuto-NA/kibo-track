/**
 * Detects degenerate 3D point configurations unsupported by non-coplanar EPnP.
 */
import { Matrix, SVD } from "ml-matrix";
import type { ObjectPoint3D } from "../core/types.js";
import {
  COLLINEARITY_RANK_TOLERANCE,
  COPLANARITY_RANK_TOLERANCE,
  DUPLICATE_POINT_DISTANCE_EPSILON,
  MINIMUM_ESTIMATE_POSE_CORRESPONDENCE_COUNT,
} from "./constants.js";

export type GeometryDegeneracyReason =
  | "notEnoughPoints"
  | "degenerateConfiguration";

export interface GeometryDegeneracyCheckResult {
  readonly isDegenerate: boolean;
  readonly reason?: GeometryDegeneracyReason;
}

function computeObjectPointCentroid(
  objectPoints: ReadonlyArray<ObjectPoint3D>,
): ObjectPoint3D {
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;

  for (const objectPoint of objectPoints) {
    sumX += objectPoint[0];
    sumY += objectPoint[1];
    sumZ += objectPoint[2];
  }

  const inverseCount = 1 / objectPoints.length;
  return [sumX * inverseCount, sumY * inverseCount, sumZ * inverseCount];
}

function hasDuplicateObjectPoints(objectPoints: ReadonlyArray<ObjectPoint3D>): boolean {
  for (let firstIndex = 0; firstIndex < objectPoints.length; firstIndex += 1) {
    const firstPoint = objectPoints[firstIndex];

    if (firstPoint === undefined) {
      continue;
    }

    for (let secondIndex = firstIndex + 1; secondIndex < objectPoints.length; secondIndex += 1) {
      const secondPoint = objectPoints[secondIndex];

      if (secondPoint === undefined) {
        continue;
      }

      const deltaX = firstPoint[0] - secondPoint[0];
      const deltaY = firstPoint[1] - secondPoint[1];
      const deltaZ = firstPoint[2] - secondPoint[2];
      const distance = Math.hypot(deltaX, deltaY, deltaZ);

      if (distance <= DUPLICATE_POINT_DISTANCE_EPSILON) {
        return true;
      }
    }
  }

  return false;
}

function computeCenteredPointSingularValueRatios(
  objectPoints: ReadonlyArray<ObjectPoint3D>,
): readonly [number, number, number] {
  const centroid = computeObjectPointCentroid(objectPoints);
  const centeredPoints = Matrix.zeros(objectPoints.length, 3);

  for (let pointIndex = 0; pointIndex < objectPoints.length; pointIndex += 1) {
    const objectPoint = objectPoints[pointIndex];

    if (objectPoint === undefined) {
      continue;
    }

    centeredPoints.set(pointIndex, 0, objectPoint[0] - centroid[0]);
    centeredPoints.set(pointIndex, 1, objectPoint[1] - centroid[1]);
    centeredPoints.set(pointIndex, 2, objectPoint[2] - centroid[2]);
  }

  const singularValues = new SVD(centeredPoints, { autoTranspose: true }).diagonal;
  const largestSingularValue = singularValues[0] ?? 0;

  if (largestSingularValue <= COLLINEARITY_RANK_TOLERANCE) {
    return [0, 0, 0];
  }

  const middleRatio = (singularValues[1] ?? 0) / largestSingularValue;
  const smallestRatio = (singularValues[2] ?? 0) / largestSingularValue;

  return [1, middleRatio, smallestRatio];
}

function isNearlyCollinearObjectPoints(
  objectPoints: ReadonlyArray<ObjectPoint3D>,
): boolean {
  const [, middleRatio, smallestRatio] = computeCenteredPointSingularValueRatios(objectPoints);

  return (
    middleRatio <= COLLINEARITY_RANK_TOLERANCE &&
    smallestRatio <= COLLINEARITY_RANK_TOLERANCE
  );
}

function isNearlyCoplanarObjectPoints(
  objectPoints: ReadonlyArray<ObjectPoint3D>,
): boolean {
  const [, middleRatio, smallestRatio] = computeCenteredPointSingularValueRatios(objectPoints);

  if (middleRatio <= COLLINEARITY_RANK_TOLERANCE) {
    return false;
  }

  return smallestRatio <= COPLANARITY_RANK_TOLERANCE;
}

/** Returns whether the object point configuration is unsupported by v0.3 EPnP. */
export function checkGeometryDegeneracy(
  objectPoints: ReadonlyArray<ObjectPoint3D>,
): GeometryDegeneracyCheckResult {
  if (objectPoints.length < MINIMUM_ESTIMATE_POSE_CORRESPONDENCE_COUNT) {
    return {
      isDegenerate: true,
      reason: "notEnoughPoints",
    };
  }

  if (hasDuplicateObjectPoints(objectPoints)) {
    return {
      isDegenerate: true,
      reason: "degenerateConfiguration",
    };
  }

  if (isNearlyCollinearObjectPoints(objectPoints)) {
    return {
      isDegenerate: true,
      reason: "degenerateConfiguration",
    };
  }

  if (isNearlyCoplanarObjectPoints(objectPoints)) {
    return {
      isDegenerate: true,
      reason: "degenerateConfiguration",
    };
  }

  return {
    isDegenerate: false,
  };
}
