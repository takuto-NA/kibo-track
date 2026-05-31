/**
 * EPnP control point selection from object-space correspondences.
 */
import { Matrix, SVD } from "ml-matrix";
import type { ObjectPoint3D } from "../../core/types.js";

export type ControlPoint3D = readonly [number, number, number];
export type ControlPointSet = readonly [
  ControlPoint3D,
  ControlPoint3D,
  ControlPoint3D,
  ControlPoint3D,
];

function computeObjectPointCentroid(
  objectPoints: ReadonlyArray<ObjectPoint3D>,
): ControlPoint3D {
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

/** Selects four control points: centroid plus three PCA directions. */
export function chooseControlPoints(
  objectPoints: ReadonlyArray<ObjectPoint3D>,
): ControlPointSet {
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

  const gramMatrix = centeredPoints.transpose().mmul(centeredPoints);
  const singularValueDecomposition = new SVD(gramMatrix, { autoTranspose: true });
  const principalDirectionsTransposed = singularValueDecomposition.rightSingularVectors.transpose();
  const singularValues = singularValueDecomposition.diagonal;

  const controlPoints: ControlPoint3D[] = [centroid];

  for (let directionIndex = 1; directionIndex < 4; directionIndex += 1) {
    const singularValue = singularValues[directionIndex - 1] ?? 0;
    const scale = Math.sqrt(singularValue / objectPoints.length);
    const directionRow = directionIndex - 1;

    const directionX = principalDirectionsTransposed.get(directionRow, 0);
    const directionY = principalDirectionsTransposed.get(directionRow, 1);
    const directionZ = principalDirectionsTransposed.get(directionRow, 2);

    controlPoints.push([
      centroid[0] + scale * directionX,
      centroid[1] + scale * directionY,
      centroid[2] + scale * directionZ,
    ]);
  }

  const firstControlPoint = controlPoints[0];
  const secondControlPoint = controlPoints[1];
  const thirdControlPoint = controlPoints[2];
  const fourthControlPoint = controlPoints[3];

  if (
    firstControlPoint === undefined ||
    secondControlPoint === undefined ||
    thirdControlPoint === undefined ||
    fourthControlPoint === undefined
  ) {
    throw new RangeError("EPnP control point selection did not produce four points.");
  }

  return [firstControlPoint, secondControlPoint, thirdControlPoint, fourthControlPoint];
}

/** Computes squared distances between the six control point pairs used by EPnP. */
export function computeControlPointPairDistances(
  controlPoints: ControlPointSet,
): readonly number[] {
  const pairIndices: readonly (readonly [number, number])[] = [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 2],
    [1, 3],
    [2, 3],
  ];

  return pairIndices.map(([firstIndex, secondIndex]) => {
    const firstControlPoint = controlPoints[firstIndex];
    const secondControlPoint = controlPoints[secondIndex];

    if (firstControlPoint === undefined || secondControlPoint === undefined) {
      throw new RangeError("Control point index is out of range.");
    }

    const deltaX = firstControlPoint[0] - secondControlPoint[0];
    const deltaY = firstControlPoint[1] - secondControlPoint[1];
    const deltaZ = firstControlPoint[2] - secondControlPoint[2];
    return deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;
  });
}
