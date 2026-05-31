/**
 * EPnP pose recovery from beta coefficients and null-space basis.
 */
import { determinant, Matrix, SVD } from "ml-matrix";
import type { CameraIntrinsics, ImagePoint2D, ObjectPoint3D, Pose, RowMajorMatrix3 } from "../../core/types.js";
import { projectPoints } from "../../core/project-points.js";
import { meanReprojectionErrorPx } from "../../core/reprojection-error.js";
import { rotationMatrixToQuaternion } from "../../core/quaternion.js";
import { dotProduct3 } from "./linear-algebra.js";
import type { BarycentricCoordinate4 } from "./barycentric-coordinates.js";
import type { ControlPoint3D } from "./control-points.js";
import type { EpnpCameraParameters } from "./measurement-matrix.js";

function toRowMajorMatrix3(values: readonly number[]): RowMajorMatrix3 {
  if (values.length !== 9) {
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

export interface EpnpPoseRecoveryInput {
  readonly objectPoints: ReadonlyArray<ObjectPoint3D>;
  readonly imagePoints: ReadonlyArray<ImagePoint2D>;
  readonly barycentricCoordinates: ReadonlyArray<BarycentricCoordinate4>;
  readonly nullSpaceBasis: readonly number[];
  readonly betas: readonly [number, number, number, number];
  readonly cameraParameters: EpnpCameraParameters;
}

export interface EpnpRecoveredPose {
  readonly rotationMatrix: RowMajorMatrix3;
  readonly translation: readonly [number, number, number];
  readonly cameraPoints: readonly ObjectPoint3D[];
  readonly meanReprojectionErrorPx: number;
}

function computeCameraControlPoints(
  betas: readonly [number, number, number, number],
  nullSpaceBasis: readonly number[],
): ControlPoint3D[] {
  const cameraControlPoints: ControlPoint3D[] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  for (let betaIndex = 0; betaIndex < 4; betaIndex += 1) {
    const beta = betas[betaIndex] ?? 0;
    const basisVector = nullSpaceBasis.slice(12 * (11 - betaIndex), 12 * (12 - betaIndex));

    for (let controlIndex = 0; controlIndex < 4; controlIndex += 1) {
      const baseIndex = controlIndex * 3;
      const currentControlPoint = cameraControlPoints[controlIndex];

      if (currentControlPoint === undefined) {
        throw new RangeError("Camera control point is missing.");
      }

      cameraControlPoints[controlIndex] = [
        currentControlPoint[0] + beta * basisVector[baseIndex]!,
        currentControlPoint[1] + beta * basisVector[baseIndex + 1]!,
        currentControlPoint[2] + beta * basisVector[baseIndex + 2]!,
      ];
    }
  }

  return cameraControlPoints;
}

function computeCameraPointsFromBarycentricCoordinates(
  barycentricCoordinates: ReadonlyArray<BarycentricCoordinate4>,
  cameraControlPoints: ReadonlyArray<ControlPoint3D>,
): ObjectPoint3D[] {
  return barycentricCoordinates.map((barycentricCoordinate) => {
    let cameraX = 0;
    let cameraY = 0;
    let cameraZ = 0;

    for (let controlIndex = 0; controlIndex < 4; controlIndex += 1) {
      const weight = barycentricCoordinate[controlIndex] ?? 0;
      const controlPoint = cameraControlPoints[controlIndex];

      if (controlPoint === undefined) {
        throw new RangeError("Camera control point is missing.");
      }

      cameraX += weight * controlPoint[0];
      cameraY += weight * controlPoint[1];
      cameraZ += weight * controlPoint[2];
    }

    return [cameraX, cameraY, cameraZ] as ObjectPoint3D;
  });
}

function flipCameraPointsSignIfNeeded(
  cameraPoints: ObjectPoint3D[],
  cameraControlPoints: ControlPoint3D[],
): void {
  const firstCameraPoint = cameraPoints[0];

  if (firstCameraPoint === undefined || firstCameraPoint[2] >= 0) {
    return;
  }

  for (let controlIndex = 0; controlIndex < 4; controlIndex += 1) {
    const controlPoint = cameraControlPoints[controlIndex];

    if (controlPoint === undefined) {
      continue;
    }

    cameraControlPoints[controlIndex] = [
      -controlPoint[0],
      -controlPoint[1],
      -controlPoint[2],
    ];
  }

  for (let pointIndex = 0; pointIndex < cameraPoints.length; pointIndex += 1) {
    const cameraPoint = cameraPoints[pointIndex];

    if (cameraPoint === undefined) {
      continue;
    }

    cameraPoints[pointIndex] = [-cameraPoint[0], -cameraPoint[1], -cameraPoint[2]];
  }
}

function estimateRotationAndTranslationFromCorrespondences(
  objectPoints: ReadonlyArray<ObjectPoint3D>,
  cameraPoints: ReadonlyArray<ObjectPoint3D>,
): { rotationMatrix: RowMajorMatrix3; translation: readonly [number, number, number] } {
  let objectCentroidX = 0;
  let objectCentroidY = 0;
  let objectCentroidZ = 0;
  let cameraCentroidX = 0;
  let cameraCentroidY = 0;
  let cameraCentroidZ = 0;

  for (let pointIndex = 0; pointIndex < objectPoints.length; pointIndex += 1) {
    const objectPoint = objectPoints[pointIndex];
    const cameraPoint = cameraPoints[pointIndex];

    if (objectPoint === undefined || cameraPoint === undefined) {
      throw new RangeError("Correspondence is missing for pose recovery.");
    }

    objectCentroidX += objectPoint[0];
    objectCentroidY += objectPoint[1];
    objectCentroidZ += objectPoint[2];
    cameraCentroidX += cameraPoint[0];
    cameraCentroidY += cameraPoint[1];
    cameraCentroidZ += cameraPoint[2];
  }

  const inverseCount = 1 / objectPoints.length;
  objectCentroidX *= inverseCount;
  objectCentroidY *= inverseCount;
  objectCentroidZ *= inverseCount;
  cameraCentroidX *= inverseCount;
  cameraCentroidY *= inverseCount;
  cameraCentroidZ *= inverseCount;

  const covarianceMatrix = Matrix.zeros(3, 3);

  for (let pointIndex = 0; pointIndex < objectPoints.length; pointIndex += 1) {
    const objectPoint = objectPoints[pointIndex];
    const cameraPoint = cameraPoints[pointIndex];

    if (objectPoint === undefined || cameraPoint === undefined) {
      throw new RangeError("Correspondence is missing for covariance accumulation.");
    }

    const centeredObjectX = objectPoint[0] - objectCentroidX;
    const centeredObjectY = objectPoint[1] - objectCentroidY;
    const centeredObjectZ = objectPoint[2] - objectCentroidZ;
    const centeredCameraX = cameraPoint[0] - cameraCentroidX;
    const centeredCameraY = cameraPoint[1] - cameraCentroidY;
    const centeredCameraZ = cameraPoint[2] - cameraCentroidZ;

    covarianceMatrix.set(0, 0, covarianceMatrix.get(0, 0) + centeredCameraX * centeredObjectX);
    covarianceMatrix.set(0, 1, covarianceMatrix.get(0, 1) + centeredCameraX * centeredObjectY);
    covarianceMatrix.set(0, 2, covarianceMatrix.get(0, 2) + centeredCameraX * centeredObjectZ);
    covarianceMatrix.set(1, 0, covarianceMatrix.get(1, 0) + centeredCameraY * centeredObjectX);
    covarianceMatrix.set(1, 1, covarianceMatrix.get(1, 1) + centeredCameraY * centeredObjectY);
    covarianceMatrix.set(1, 2, covarianceMatrix.get(1, 2) + centeredCameraY * centeredObjectZ);
    covarianceMatrix.set(2, 0, covarianceMatrix.get(2, 0) + centeredCameraZ * centeredObjectX);
    covarianceMatrix.set(2, 1, covarianceMatrix.get(2, 1) + centeredCameraZ * centeredObjectY);
    covarianceMatrix.set(2, 2, covarianceMatrix.get(2, 2) + centeredCameraZ * centeredObjectZ);
  }

  const singularValueDecomposition = new SVD(covarianceMatrix, { autoTranspose: true });
  const rotationMatrixMatrix = singularValueDecomposition.leftSingularVectors.mmul(
    singularValueDecomposition.rightSingularVectors.transpose(),
  );

  const rotationMatrixArray = rotationMatrixMatrix.to1DArray();

  if (determinant(rotationMatrixMatrix) < 0) {
    rotationMatrixArray[6] = -rotationMatrixArray[6]!;
    rotationMatrixArray[7] = -rotationMatrixArray[7]!;
    rotationMatrixArray[8] = -rotationMatrixArray[8]!;
  }

  const rotationMatrix = toRowMajorMatrix3(rotationMatrixArray);
  const translation: [number, number, number] = [
    cameraCentroidX -
      dotProduct3(
        [rotationMatrix[0]!, rotationMatrix[1]!, rotationMatrix[2]!],
        [objectCentroidX, objectCentroidY, objectCentroidZ],
      ),
    cameraCentroidY -
      dotProduct3(
        [rotationMatrix[3]!, rotationMatrix[4]!, rotationMatrix[5]!],
        [objectCentroidX, objectCentroidY, objectCentroidZ],
      ),
    cameraCentroidZ -
      dotProduct3(
        [rotationMatrix[6]!, rotationMatrix[7]!, rotationMatrix[8]!],
        [objectCentroidX, objectCentroidY, objectCentroidZ],
      ),
  ];

  return {
    rotationMatrix,
    translation,
  };
}

function buildCameraIntrinsicsFromEpnpParameters(
  cameraParameters: EpnpCameraParameters,
): CameraIntrinsics {
  return {
    focalLengthX: cameraParameters.focalLengthX,
    focalLengthY: cameraParameters.focalLengthY,
    principalPointX: cameraParameters.principalPointX,
    principalPointY: cameraParameters.principalPointY,
  };
}

function buildPoseFromRotationMatrixAndTranslation(
  rotationMatrix: RowMajorMatrix3,
  translation: readonly [number, number, number],
): Pose {
  return {
    rotation: rotationMatrixToQuaternion(rotationMatrix),
    translation: [translation[0], translation[1], translation[2]],
  };
}

function computeMeanReprojectionErrorPx(
  objectPoints: ReadonlyArray<ObjectPoint3D>,
  imagePoints: ReadonlyArray<ImagePoint2D>,
  rotationMatrix: RowMajorMatrix3,
  translation: readonly [number, number, number],
  cameraParameters: EpnpCameraParameters,
): number {
  const pose = buildPoseFromRotationMatrixAndTranslation(rotationMatrix, translation);
  const cameraIntrinsics = buildCameraIntrinsicsFromEpnpParameters(cameraParameters);
  const projectedImagePoints = projectPoints(objectPoints, pose, cameraIntrinsics);

  return meanReprojectionErrorPx(imagePoints, projectedImagePoints);
}

/** Recovers rotation and translation for one beta candidate. */
export function recoverPoseFromBetas(
  recoveryInput: EpnpPoseRecoveryInput,
): EpnpRecoveredPose {
  const cameraControlPoints = computeCameraControlPoints(
    recoveryInput.betas,
    recoveryInput.nullSpaceBasis,
  );
  const cameraPoints = computeCameraPointsFromBarycentricCoordinates(
    recoveryInput.barycentricCoordinates,
    cameraControlPoints,
  );

  flipCameraPointsSignIfNeeded(cameraPoints, cameraControlPoints);

  const { rotationMatrix, translation } = estimateRotationAndTranslationFromCorrespondences(
    recoveryInput.objectPoints,
    cameraPoints,
  );

  const meanReprojectionErrorPx = computeMeanReprojectionErrorPx(
    recoveryInput.objectPoints,
    recoveryInput.imagePoints,
    rotationMatrix,
    translation,
    recoveryInput.cameraParameters,
  );

  return {
    rotationMatrix,
    translation,
    cameraPoints,
    meanReprojectionErrorPx,
  };
}

/** Converts an EPnP row-major rotation matrix and translation into a public Pose. */
export function epnpRecoveredPoseToPose(
  recoveredPose: EpnpRecoveredPose,
): Pose {
  return buildPoseFromRotationMatrixAndTranslation(
    recoveredPose.rotationMatrix,
    recoveredPose.translation,
  );
}

/** Returns whether all recovered camera-space points have positive depth. */
export function hasPositiveCameraSpaceDepth(
  cameraPoints: ReadonlyArray<ObjectPoint3D>,
  minimumDepth: number,
): boolean {
  for (const cameraPoint of cameraPoints) {
    if (cameraPoint[2] <= minimumDepth) {
      return false;
    }
  }

  return true;
}
