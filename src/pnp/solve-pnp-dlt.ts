/**
 * Direct Linear Transform initial pose solver for non-coplanar PnP cold starts.
 */
import { Matrix, SVD, determinant } from "ml-matrix";
import { projectPoints } from "../core/project-points.js";
import { transformObjectPointToCamera } from "../core/pose-matrix.js";
import { meanReprojectionErrorPx } from "../core/reprojection-error.js";
import { rotationMatrixToQuaternion } from "../core/quaternion.js";
import type {
  CameraIntrinsics,
  ImagePoint2D,
  ObjectPoint3D,
  Pose,
  RowMajorMatrix3,
  Vector3,
} from "../core/types.js";
import { MINIMUM_CAMERA_SPACE_DEPTH } from "./constants.js";
import { validateEstimatePoseInput } from "./validate-estimate-input.js";
import type { EstimatePoseInput } from "./estimate-pose-types.js";

const HOMOGENEOUS_OBJECT_POINT_LENGTH = 4;
const PROJECTION_MATRIX_VALUE_COUNT = 12;
const ROTATION_MATRIX_VALUE_COUNT = 9;
const OBJECT_POINT_NORMALIZATION_TARGET_RMS = Math.sqrt(3);
const MINIMUM_NORMALIZATION_SCALE = 1e-12;

interface NormalizedObjectPoints {
  readonly points: ObjectPoint3D[];
  readonly centroid: Vector3;
  readonly scale: number;
}

interface ProjectionMatrixCandidate {
  readonly rotationMatrix: RowMajorMatrix3;
  readonly translation: Vector3;
}

export interface SolvePnPDltSuccess {
  readonly success: true;
  readonly pose: Pose;
  readonly meanReprojectionErrorPx: number;
}

export interface SolvePnPDltFailure {
  readonly success: false;
  readonly reason: "notEnoughPoints" | "degenerateConfiguration" | "invalidInput";
}

export type SolvePnPDltResult = SolvePnPDltSuccess | SolvePnPDltFailure;

function toRowMajorMatrix3(values: readonly number[]): RowMajorMatrix3 {
  if (values.length !== ROTATION_MATRIX_VALUE_COUNT) {
    throw new RangeError("Row-major 3x3 matrix requires nine values.");
  }

  return [
    values[0]!,
    values[1]!,
    values[2]!,
    values[3]!,
    values[4]!,
    values[5]!,
    values[6]!,
    values[7]!,
    values[8]!,
  ];
}

function normalizeImagePoint(
  imagePoint: ImagePoint2D,
  cameraIntrinsics: CameraIntrinsics,
): readonly [number, number] {
  return [
    (imagePoint[0] - cameraIntrinsics.principalPointX) / cameraIntrinsics.focalLengthX,
    (imagePoint[1] - cameraIntrinsics.principalPointY) / cameraIntrinsics.focalLengthY,
  ];
}

function computeObjectPointCentroid(objectPoints: ReadonlyArray<ObjectPoint3D>): Vector3 {
  let centroidX = 0;
  let centroidY = 0;
  let centroidZ = 0;

  for (const objectPoint of objectPoints) {
    centroidX += objectPoint[0];
    centroidY += objectPoint[1];
    centroidZ += objectPoint[2];
  }

  const inversePointCount = 1 / objectPoints.length;
  return [
    centroidX * inversePointCount,
    centroidY * inversePointCount,
    centroidZ * inversePointCount,
  ];
}

function normalizeObjectPoints(
  objectPoints: ReadonlyArray<ObjectPoint3D>,
): NormalizedObjectPoints {
  const centroid = computeObjectPointCentroid(objectPoints);
  let squaredDistanceSum = 0;

  for (const objectPoint of objectPoints) {
    squaredDistanceSum +=
      (objectPoint[0] - centroid[0]) ** 2 +
      (objectPoint[1] - centroid[1]) ** 2 +
      (objectPoint[2] - centroid[2]) ** 2;
  }

  const rootMeanSquareDistance = Math.sqrt(squaredDistanceSum / objectPoints.length);

  if (rootMeanSquareDistance <= MINIMUM_NORMALIZATION_SCALE) {
    throw new RangeError("Object points cannot be normalized for DLT.");
  }

  const scale = OBJECT_POINT_NORMALIZATION_TARGET_RMS / rootMeanSquareDistance;
  return {
    points: objectPoints.map((objectPoint) => [
      (objectPoint[0] - centroid[0]) * scale,
      (objectPoint[1] - centroid[1]) * scale,
      (objectPoint[2] - centroid[2]) * scale,
    ]),
    centroid,
    scale,
  };
}

function buildDltMeasurementMatrix(
  normalizedObjectPoints: ReadonlyArray<ObjectPoint3D>,
  imagePoints: ReadonlyArray<ImagePoint2D>,
  cameraIntrinsics: CameraIntrinsics,
): Matrix {
  const measurementMatrix = Matrix.zeros(imagePoints.length * 2, PROJECTION_MATRIX_VALUE_COUNT);

  for (let pointIndex = 0; pointIndex < imagePoints.length; pointIndex += 1) {
    const objectPoint = normalizedObjectPoints[pointIndex];
    const imagePoint = imagePoints[pointIndex];

    if (objectPoint === undefined || imagePoint === undefined) {
      throw new RangeError("DLT correspondence is missing.");
    }

    const [normalizedImageX, normalizedImageY] = normalizeImagePoint(
      imagePoint,
      cameraIntrinsics,
    );
    const homogeneousObjectPoint = [
      objectPoint[0],
      objectPoint[1],
      objectPoint[2],
      1,
    ] as const;
    const firstRowIndex = pointIndex * 2;
    const secondRowIndex = firstRowIndex + 1;

    for (let columnIndex = 0; columnIndex < HOMOGENEOUS_OBJECT_POINT_LENGTH; columnIndex += 1) {
      const objectValue = homogeneousObjectPoint[columnIndex]!;
      measurementMatrix.set(firstRowIndex, HOMOGENEOUS_OBJECT_POINT_LENGTH + columnIndex, -objectValue);
      measurementMatrix.set(firstRowIndex, 8 + columnIndex, normalizedImageY * objectValue);
      measurementMatrix.set(secondRowIndex, columnIndex, objectValue);
      measurementMatrix.set(secondRowIndex, 8 + columnIndex, -normalizedImageX * objectValue);
    }
  }

  return measurementMatrix;
}

function readProjectionMatrixVector(measurementMatrix: Matrix): readonly number[] {
  const singularValueDecomposition = new SVD(measurementMatrix, { autoTranspose: true });
  const rightSingularVectors = singularValueDecomposition.rightSingularVectors;
  const projectionColumnIndex = rightSingularVectors.columns - 1;
  const projectionMatrixVector: number[] = [];

  for (let rowIndex = 0; rowIndex < rightSingularVectors.rows; rowIndex += 1) {
    projectionMatrixVector.push(rightSingularVectors.get(rowIndex, projectionColumnIndex));
  }

  if (projectionMatrixVector.length !== PROJECTION_MATRIX_VALUE_COUNT) {
    throw new RangeError("DLT projection vector must contain twelve values.");
  }

  return projectionMatrixVector;
}

function extractRotationLikeMatrix(
  projectionMatrixVector: readonly number[],
  signMultiplier: number,
): Matrix {
  return new Matrix([
    [
      signMultiplier * projectionMatrixVector[0]!,
      signMultiplier * projectionMatrixVector[1]!,
      signMultiplier * projectionMatrixVector[2]!,
    ],
    [
      signMultiplier * projectionMatrixVector[4]!,
      signMultiplier * projectionMatrixVector[5]!,
      signMultiplier * projectionMatrixVector[6]!,
    ],
    [
      signMultiplier * projectionMatrixVector[8]!,
      signMultiplier * projectionMatrixVector[9]!,
      signMultiplier * projectionMatrixVector[10]!,
    ],
  ]);
}

function projectToClosestRotation(rotationLikeMatrix: Matrix): Matrix {
  const singularValueDecomposition = new SVD(rotationLikeMatrix, { autoTranspose: true });
  const leftSingularVectors = singularValueDecomposition.leftSingularVectors;
  const rightSingularVectorsTransposed =
    singularValueDecomposition.rightSingularVectors.transpose();
  let rotationMatrix = leftSingularVectors.mmul(rightSingularVectorsTransposed);

  if (determinant(rotationMatrix) < 0) {
    const handednessCorrection = Matrix.diag([1, 1, -1]);
    rotationMatrix = leftSingularVectors
      .mmul(handednessCorrection)
      .mmul(rightSingularVectorsTransposed);
  }

  return rotationMatrix;
}

function computeProjectionScale(rotationLikeMatrix: Matrix): number {
  const singularValues = new SVD(rotationLikeMatrix, { autoTranspose: true }).diagonal;
  return (
    singularValues.reduce((sum, singularValue) => sum + singularValue, 0) /
    singularValues.length
  );
}

function denormalizeTranslation(
  normalizedTranslation: Vector3,
  rotationMatrix: RowMajorMatrix3,
  normalization: NormalizedObjectPoints,
): Vector3 {
  const normalizedCentroid: Vector3 = [
    normalization.scale * normalization.centroid[0],
    normalization.scale * normalization.centroid[1],
    normalization.scale * normalization.centroid[2],
  ];

  return [
    normalizedTranslation[0] -
      rotationMatrix[0] * normalizedCentroid[0] -
      rotationMatrix[1] * normalizedCentroid[1] -
      rotationMatrix[2] * normalizedCentroid[2],
    normalizedTranslation[1] -
      rotationMatrix[3] * normalizedCentroid[0] -
      rotationMatrix[4] * normalizedCentroid[1] -
      rotationMatrix[5] * normalizedCentroid[2],
    normalizedTranslation[2] -
      rotationMatrix[6] * normalizedCentroid[0] -
      rotationMatrix[7] * normalizedCentroid[1] -
      rotationMatrix[8] * normalizedCentroid[2],
  ];
}

function buildProjectionCandidate(
  projectionMatrixVector: readonly number[],
  signMultiplier: number,
  normalization: NormalizedObjectPoints,
): ProjectionMatrixCandidate | null {
  const rotationLikeMatrix = extractRotationLikeMatrix(projectionMatrixVector, signMultiplier);
  const projectionScale = computeProjectionScale(rotationLikeMatrix);

  if (projectionScale <= MINIMUM_NORMALIZATION_SCALE) {
    return null;
  }

  const rotationMatrix = toRowMajorMatrix3(projectToClosestRotation(rotationLikeMatrix).to1DArray());
  const normalizedTranslation: Vector3 = [
    (signMultiplier * projectionMatrixVector[3]!) / projectionScale,
    (signMultiplier * projectionMatrixVector[7]!) / projectionScale,
    (signMultiplier * projectionMatrixVector[11]!) / projectionScale,
  ];

  return {
    rotationMatrix,
    translation: denormalizeTranslation(normalizedTranslation, rotationMatrix, normalization),
  };
}

function buildPose(candidate: ProjectionMatrixCandidate): Pose {
  return {
    rotation: rotationMatrixToQuaternion(candidate.rotationMatrix),
    translation: candidate.translation,
  };
}

function hasPositiveDepth(
  objectPoints: ReadonlyArray<ObjectPoint3D>,
  pose: Pose,
): boolean {
  for (const objectPoint of objectPoints) {
    const cameraPoint = transformObjectPointToCamera(objectPoint, pose);

    if (cameraPoint[2] <= MINIMUM_CAMERA_SPACE_DEPTH) {
      return false;
    }
  }

  return true;
}

/** Solves an initial cameraFromObject pose using normalized DLT. */
export function solvePnPDlt(input: EstimatePoseInput): SolvePnPDltResult {
  const validationReason = validateEstimatePoseInput(input);

  if (validationReason !== null) {
    return {
      success: false,
      reason: validationReason,
    };
  }

  try {
    const normalization = normalizeObjectPoints(input.objectPoints);
    const measurementMatrix = buildDltMeasurementMatrix(
      normalization.points,
      input.imagePoints,
      input.cameraIntrinsics,
    );
    const projectionMatrixVector = readProjectionMatrixVector(measurementMatrix);
    let bestResult: SolvePnPDltSuccess | null = null;

    for (const signMultiplier of [1, -1]) {
      const candidate = buildProjectionCandidate(
        projectionMatrixVector,
        signMultiplier,
        normalization,
      );

      if (candidate === null) {
        continue;
      }

      const pose = buildPose(candidate);

      if (!hasPositiveDepth(input.objectPoints, pose)) {
        continue;
      }

      const meanErrorPx = meanReprojectionErrorPx(
        input.imagePoints,
        projectPoints(input.objectPoints, pose, input.cameraIntrinsics),
      );

      if (bestResult === null || meanErrorPx < bestResult.meanReprojectionErrorPx) {
        bestResult = {
          success: true,
          pose,
          meanReprojectionErrorPx: meanErrorPx,
        };
      }
    }

    if (bestResult === null) {
      return {
        success: false,
        reason: "degenerateConfiguration",
      };
    }

    return bestResult;
  } catch (error) {
    if (!(error instanceof RangeError)) {
      throw error;
    }

    return {
      success: false,
      reason: "degenerateConfiguration",
    };
  }
}
