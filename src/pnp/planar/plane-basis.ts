/**
 * Builds an orthonormal plane basis and 2D coordinates for coplanar 3D points.
 */
import type { ObjectPoint3D } from "../../core/types.js";
import type { CoplanarPlaneBasis } from "./types.js";

const MINIMUM_AXIS_LENGTH = 1e-9;

function subtractPoints(
  leftPoint: ObjectPoint3D,
  rightPoint: ObjectPoint3D,
): readonly [number, number, number] {
  return [
    leftPoint[0] - rightPoint[0],
    leftPoint[1] - rightPoint[1],
    leftPoint[2] - rightPoint[2],
  ];
}

function normalizeVector(
  vector: readonly [number, number, number],
): readonly [number, number, number] {
  const length = Math.hypot(vector[0], vector[1], vector[2]);

  if (length <= MINIMUM_AXIS_LENGTH) {
    throw new RangeError("Cannot normalize a zero-length plane axis vector.");
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function crossProduct(
  leftVector: readonly [number, number, number],
  rightVector: readonly [number, number, number],
): readonly [number, number, number] {
  return [
    leftVector[1] * rightVector[2] - leftVector[2] * rightVector[1],
    leftVector[2] * rightVector[0] - leftVector[0] * rightVector[2],
    leftVector[0] * rightVector[1] - leftVector[1] * rightVector[0],
  ];
}

function dotProduct(
  leftVector: readonly [number, number, number],
  rightVector: readonly [number, number, number],
): number {
  return (
    leftVector[0] * rightVector[0] +
    leftVector[1] * rightVector[1] +
    leftVector[2] * rightVector[2]
  );
}

function projectPointToPlaneCoordinates(
  objectPoint: ObjectPoint3D,
  origin: ObjectPoint3D,
  axisU: readonly [number, number, number],
  axisV: readonly [number, number, number],
): readonly [number, number] {
  const offsetVector = subtractPoints(objectPoint, origin);
  return [dotProduct(offsetVector, axisU), dotProduct(offsetVector, axisV)];
}

/** Builds plane basis vectors and 2D coordinates for coplanar object points. */
export function buildCoplanarPlaneBasis(
  objectPoints: ReadonlyArray<ObjectPoint3D>,
): CoplanarPlaneBasis {
  const originPoint = objectPoints[0];
  const firstSpanPoint = objectPoints[1];
  const secondSpanPoint = objectPoints[2];

  if (originPoint === undefined || firstSpanPoint === undefined || secondSpanPoint === undefined) {
    throw new RangeError("At least three object points are required for plane basis construction.");
  }

  const firstEdgeVector = subtractPoints(firstSpanPoint, originPoint);
  const secondEdgeVector = subtractPoints(secondSpanPoint, originPoint);
  const axisNormal = normalizeVector(crossProduct(firstEdgeVector, secondEdgeVector));
  const axisU = normalizeVector(firstEdgeVector);
  const axisV = normalizeVector(crossProduct(axisNormal, axisU));

  const planeCoordinates2D = objectPoints.map((objectPoint) =>
    projectPointToPlaneCoordinates(objectPoint, originPoint, axisU, axisV),
  );

  return {
    origin: originPoint,
    axisU,
    axisV,
    axisNormal,
    planeCoordinates2D,
  };
}

function transposeRotationMatrix(
  rotationMatrix: readonly [number, number, number, number, number, number, number, number, number],
): readonly [number, number, number, number, number, number, number, number, number] {
  return [
    rotationMatrix[0],
    rotationMatrix[3],
    rotationMatrix[6],
    rotationMatrix[1],
    rotationMatrix[4],
    rotationMatrix[7],
    rotationMatrix[2],
    rotationMatrix[5],
    rotationMatrix[8],
  ];
}

function multiplyRotationMatrices(
  leftRotationMatrix: readonly [number, number, number, number, number, number, number, number, number],
  rightRotationMatrix: readonly [number, number, number, number, number, number, number, number, number],
): readonly [number, number, number, number, number, number, number, number, number] {
  const result: number[] = [];

  for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < 3; columnIndex += 1) {
      let sum = 0;

      for (let innerIndex = 0; innerIndex < 3; innerIndex += 1) {
        const leftValue = leftRotationMatrix[rowIndex * 3 + innerIndex];
        const rightValue = rightRotationMatrix[innerIndex * 3 + columnIndex];

        if (leftValue === undefined || rightValue === undefined) {
          continue;
        }

        sum += leftValue * rightValue;
      }

      result.push(sum);
    }
  }

  return [
    result[0] ?? 0,
    result[1] ?? 0,
    result[2] ?? 0,
    result[3] ?? 0,
    result[4] ?? 0,
    result[5] ?? 0,
    result[6] ?? 0,
    result[7] ?? 0,
    result[8] ?? 0,
  ] as const;
}

function multiplyRotationMatrixVector(
  rotationMatrix: readonly [number, number, number, number, number, number, number, number, number],
  vector: ObjectPoint3D,
): readonly [number, number, number] {
  return [
    rotationMatrix[0] * vector[0] + rotationMatrix[1] * vector[1] + rotationMatrix[2] * vector[2],
    rotationMatrix[3] * vector[0] + rotationMatrix[4] * vector[1] + rotationMatrix[5] * vector[2],
    rotationMatrix[6] * vector[0] + rotationMatrix[7] * vector[1] + rotationMatrix[8] * vector[2],
  ];
}

function buildWorldFromPlaneRotationMatrix(
  planeBasis: CoplanarPlaneBasis,
): readonly [number, number, number, number, number, number, number, number, number] {
  return [
    planeBasis.axisU[0],
    planeBasis.axisV[0],
    planeBasis.axisNormal[0],
    planeBasis.axisU[1],
    planeBasis.axisV[1],
    planeBasis.axisNormal[1],
    planeBasis.axisU[2],
    planeBasis.axisV[2],
    planeBasis.axisNormal[2],
  ];
}

/** Converts a camera-from-plane pose into camera-from-object (world) pose. */
export function convertCameraFromPlanePoseToObjectPose(
  cameraFromPlaneRotationMatrix: readonly [number, number, number, number, number, number, number, number, number],
  cameraFromPlaneTranslation: readonly [number, number, number],
  planeBasis: CoplanarPlaneBasis,
): {
  readonly rotationMatrix: readonly [number, number, number, number, number, number, number, number, number];
  readonly translation: readonly [number, number, number];
} {
  const worldFromPlaneRotation = buildWorldFromPlaneRotationMatrix(planeBasis);
  const worldFromPlaneRotationTransposed = transposeRotationMatrix(worldFromPlaneRotation);
  const cameraFromObjectRotation = multiplyRotationMatrices(
    cameraFromPlaneRotationMatrix,
    worldFromPlaneRotationTransposed,
  );
  const rotatedOrigin = multiplyRotationMatrixVector(
    cameraFromObjectRotation,
    planeBasis.origin,
  );

  return {
    rotationMatrix: cameraFromObjectRotation,
    translation: [
      cameraFromPlaneTranslation[0] - rotatedOrigin[0],
      cameraFromPlaneTranslation[1] - rotatedOrigin[1],
      cameraFromPlaneTranslation[2] - rotatedOrigin[2],
    ],
  };
}
