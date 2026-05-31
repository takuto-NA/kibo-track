/**
 * Rodrigues rotation vector conversions for OpenCV-compatible pose math.
 */
import { IDENTITY_MATRIX3, ROTATION_VECTOR_ANGLE_EPSILON } from "./constants.js";
import {
  addRowMajorMatrix3,
  createSkewSymmetricMatrix,
  multiplyRowMajorMatrix3,
  scaleRowMajorMatrix3,
} from "./matrix3.js";
import {
  canonicalizeQuaternionSign,
  normalizeQuaternion,
  quaternionToRotationMatrix,
  rotationMatrixToQuaternion,
} from "./quaternion.js";
import type { Quaternion, RotationVector, RowMajorMatrix3 } from "./types.js";

function computeRotationVectorAngle(rotationVector: RotationVector): number {
  const [axisX, axisY, axisZ] = rotationVector;
  return Math.hypot(axisX, axisY, axisZ);
}

/** Converts an OpenCV-style rotation vector to a row-major rotation matrix. */
export function rodriguesToRotationMatrix(
  rotationVector: RotationVector,
): RowMajorMatrix3 {
  const rotationAngle = computeRotationVectorAngle(rotationVector);

  if (rotationAngle <= ROTATION_VECTOR_ANGLE_EPSILON) {
    return IDENTITY_MATRIX3;
  }

  const [axisX, axisY, axisZ] = rotationVector;
  const normalizedAxisX = axisX / rotationAngle;
  const normalizedAxisY = axisY / rotationAngle;
  const normalizedAxisZ = axisZ / rotationAngle;

  const skewMatrix = createSkewSymmetricMatrix(
    normalizedAxisX,
    normalizedAxisY,
    normalizedAxisZ,
  );
  const skewMatrixSquared = multiplyRowMajorMatrix3(skewMatrix, skewMatrix);

  const sineTerm = Math.sin(rotationAngle);
  const cosineTerm = 1 - Math.cos(rotationAngle);

  const rotationMatrix = addRowMajorMatrix3(
    IDENTITY_MATRIX3,
    addRowMajorMatrix3(
      scaleRowMajorMatrix3(skewMatrix, sineTerm),
      scaleRowMajorMatrix3(skewMatrixSquared, cosineTerm),
    ),
  );

  return rotationMatrix;
}

/** Converts a row-major rotation matrix to an OpenCV-style rotation vector. */
export function rotationMatrixToRodrigues(
  rotationMatrix: RowMajorMatrix3,
): RotationVector {
  const quaternion = rotationMatrixToQuaternion(rotationMatrix);
  const [componentX, componentY, componentZ, componentW] =
    canonicalizeQuaternionSign(quaternion);

  const vectorLength = Math.hypot(componentX, componentY, componentZ);
  if (vectorLength <= ROTATION_VECTOR_ANGLE_EPSILON) {
    return [0, 0, 0];
  }

  const angle = 2 * Math.atan2(vectorLength, componentW);
  const scale = angle / vectorLength;

  return [componentX * scale, componentY * scale, componentZ * scale];
}

/** Converts a rotation vector to a quaternion. */
export function rotationVectorToQuaternion(
  rotationVector: RotationVector,
): Quaternion {
  const rotationMatrix = rodriguesToRotationMatrix(rotationVector);
  return rotationMatrixToQuaternion(rotationMatrix);
}

/** Converts a quaternion to a rotation vector. */
export function quaternionToRotationVector(quaternion: Quaternion): RotationVector {
  const normalizedQuaternion = normalizeQuaternion(quaternion);
  const rotationMatrix = quaternionToRotationMatrix(normalizedQuaternion);
  return rotationMatrixToRodrigues(rotationMatrix);
}
