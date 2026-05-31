/**
 * Quaternion normalization and sign canonicalization for cameraFromObject poses.
 */
import { QUATERNION_TOLERANCE, VECTOR_LENGTH_EPSILON } from "./constants.js";
import type { Quaternion, RowMajorMatrix3 } from "./types.js";

function assertFiniteQuaternionComponents(quaternion: Quaternion): void {
  const [componentX, componentY, componentZ, componentW] = quaternion;
  if (
    !Number.isFinite(componentX) ||
    !Number.isFinite(componentY) ||
    !Number.isFinite(componentZ) ||
    !Number.isFinite(componentW)
  ) {
    throw new RangeError("Quaternion components must be finite numbers.");
  }
}

function computeQuaternionLength(quaternion: Quaternion): number {
  const [componentX, componentY, componentZ, componentW] = quaternion;
  return Math.hypot(componentX, componentY, componentZ, componentW);
}

/** Returns a unit-length quaternion. */
export function normalizeQuaternion(quaternion: Quaternion): Quaternion {
  assertFiniteQuaternionComponents(quaternion);

  const length = computeQuaternionLength(quaternion);
  if (length <= VECTOR_LENGTH_EPSILON) {
    throw new RangeError("Quaternion length must be greater than zero.");
  }

  const [componentX, componentY, componentZ, componentW] = quaternion;
  return [
    componentX / length,
    componentY / length,
    componentZ / length,
    componentW / length,
  ];
}

function canonicalizeSignedZero(value: number): number {
  return value === 0 ? 0 : value;
}

/** Canonicalizes a single quaternion so that `w >= 0`. */
export function canonicalizeQuaternionSign(quaternion: Quaternion): Quaternion {
  const normalizedQuaternion = normalizeQuaternion(quaternion);
  const [componentX, componentY, componentZ, componentW] = normalizedQuaternion;

  if (componentW >= 0) {
    return [
      canonicalizeSignedZero(componentX),
      canonicalizeSignedZero(componentY),
      canonicalizeSignedZero(componentZ),
      canonicalizeSignedZero(componentW),
    ];
  }

  return [
    canonicalizeSignedZero(-componentX),
    canonicalizeSignedZero(-componentY),
    canonicalizeSignedZero(-componentZ),
    canonicalizeSignedZero(-componentW),
  ];
}

/** Aligns quaternion sign to a previous frame quaternion for temporal continuity. */
export function alignQuaternionSignToPrevious(
  previousQuaternion: Quaternion,
  currentQuaternion: Quaternion,
): Quaternion {
  const normalizedCurrentQuaternion = normalizeQuaternion(currentQuaternion);
  const normalizedPreviousQuaternion = normalizeQuaternion(previousQuaternion);

  const dotProduct =
    normalizedPreviousQuaternion[0] * normalizedCurrentQuaternion[0] +
    normalizedPreviousQuaternion[1] * normalizedCurrentQuaternion[1] +
    normalizedPreviousQuaternion[2] * normalizedCurrentQuaternion[2] +
    normalizedPreviousQuaternion[3] * normalizedCurrentQuaternion[3];

  if (dotProduct >= 0) {
    return normalizedCurrentQuaternion;
  }

  const [componentX, componentY, componentZ, componentW] =
    normalizedCurrentQuaternion;
  return [
    canonicalizeSignedZero(-componentX),
    canonicalizeSignedZero(-componentY),
    canonicalizeSignedZero(-componentZ),
    canonicalizeSignedZero(-componentW),
  ];
}

/** Converts a quaternion to a row-major 3x3 rotation matrix. */
export function quaternionToRotationMatrix(
  quaternion: Quaternion,
): RowMajorMatrix3 {
  const [componentX, componentY, componentZ, componentW] =
    canonicalizeQuaternionSign(quaternion);

  const twoComponentX = 2 * componentX;
  const twoComponentY = 2 * componentY;
  const twoComponentZ = 2 * componentZ;
  const twoComponentW = 2 * componentW;

  const twoComponentXComponentY = twoComponentX * componentY;
  const twoComponentXComponentZ = twoComponentX * componentZ;
  const twoComponentYComponentZ = twoComponentY * componentZ;

  const twoComponentWComponentX = twoComponentW * componentX;
  const twoComponentWComponentY = twoComponentW * componentY;
  const twoComponentWComponentZ = twoComponentW * componentZ;

  return [
    1 - twoComponentY * componentY - twoComponentZ * componentZ,
    twoComponentXComponentY - twoComponentWComponentZ,
    twoComponentXComponentZ + twoComponentWComponentY,
    twoComponentXComponentY + twoComponentWComponentZ,
    1 - twoComponentX * componentX - twoComponentZ * componentZ,
    twoComponentYComponentZ - twoComponentWComponentX,
    twoComponentXComponentZ - twoComponentWComponentY,
    twoComponentYComponentZ + twoComponentWComponentX,
    1 - twoComponentX * componentX - twoComponentY * componentY,
  ];
}

/** Converts a row-major 3x3 rotation matrix to a quaternion. */
export function rotationMatrixToQuaternion(
  rotationMatrix: RowMajorMatrix3,
): Quaternion {
  const [
    element00,
    element01,
    element02,
    element10,
    element11,
    element12,
    element20,
    element21,
    element22,
  ] = rotationMatrix;

  const trace = element00 + element11 + element22;

  let componentX = 0;
  let componentY = 0;
  let componentZ = 0;
  let componentW = 0;

  if (trace > 0) {
    const scale = Math.sqrt(trace + 1) * 2;
    componentW = 0.25 * scale;
    componentX = (element21 - element12) / scale;
    componentY = (element02 - element20) / scale;
    componentZ = (element10 - element01) / scale;
  } else if (element00 > element11 && element00 > element22) {
    const scale = Math.sqrt(1 + element00 - element11 - element22) * 2;
    componentW = (element21 - element12) / scale;
    componentX = 0.25 * scale;
    componentY = (element01 + element10) / scale;
    componentZ = (element02 + element20) / scale;
  } else if (element11 > element22) {
    const scale = Math.sqrt(1 + element11 - element00 - element22) * 2;
    componentW = (element02 - element20) / scale;
    componentX = (element01 + element10) / scale;
    componentY = 0.25 * scale;
    componentZ = (element12 + element21) / scale;
  } else {
    const scale = Math.sqrt(1 + element22 - element00 - element11) * 2;
    componentW = (element10 - element01) / scale;
    componentX = (element02 + element20) / scale;
    componentY = (element12 + element21) / scale;
    componentZ = 0.25 * scale;
  }

  const quaternion: Quaternion = [componentX, componentY, componentZ, componentW];
  return canonicalizeQuaternionSign(normalizeQuaternion(quaternion));
}

function computeNormalizedQuaternionDotProduct(
  leftQuaternion: Quaternion,
  rightQuaternion: Quaternion,
): number {
  return (
    leftQuaternion[0] * rightQuaternion[0] +
    leftQuaternion[1] * rightQuaternion[1] +
    leftQuaternion[2] * rightQuaternion[2] +
    leftQuaternion[3] * rightQuaternion[3]
  );
}

/** Returns the shortest rotation angle in radians between two quaternion orientations. */
export function computeQuaternionGeodesicAngleRadians(
  startQuaternion: Quaternion,
  endQuaternion: Quaternion,
): number {
  const normalizedStartQuaternion = normalizeQuaternion(startQuaternion);
  const alignedEndQuaternion = alignQuaternionSignToPrevious(
    normalizedStartQuaternion,
    endQuaternion,
  );
  const normalizedEndQuaternion = normalizeQuaternion(alignedEndQuaternion);
  const clampedAbsoluteDotProduct = Math.min(
    1,
    Math.abs(
      computeNormalizedQuaternionDotProduct(
        normalizedStartQuaternion,
        normalizedEndQuaternion,
      ),
    ),
  );

  return 2 * Math.acos(clampedAbsoluteDotProduct);
}

/** Spherical linear interpolation between two quaternions. */
export function slerpQuaternion(
  startQuaternion: Quaternion,
  endQuaternion: Quaternion,
  interpolationFactor: number,
): Quaternion {
  if (interpolationFactor < 0 || interpolationFactor > 1) {
    throw new RangeError("Interpolation factor must be between 0 and 1.");
  }

  const alignedEndQuaternion = alignQuaternionSignToPrevious(
    startQuaternion,
    endQuaternion,
  );
  const normalizedStartQuaternion = normalizeQuaternion(startQuaternion);
  const normalizedEndQuaternion = normalizeQuaternion(alignedEndQuaternion);

  const clampedDotProduct = Math.min(
    1,
    Math.max(
      -1,
      computeNormalizedQuaternionDotProduct(
        normalizedStartQuaternion,
        normalizedEndQuaternion,
      ),
    ),
  );
  const angleBetween = Math.acos(clampedDotProduct);

  if (angleBetween <= QUATERNION_TOLERANCE) {
    return normalizedStartQuaternion;
  }

  const startWeight =
    Math.sin((1 - interpolationFactor) * angleBetween) / Math.sin(angleBetween);
  const endWeight = Math.sin(interpolationFactor * angleBetween) / Math.sin(angleBetween);

  const interpolatedQuaternion: Quaternion = [
    normalizedStartQuaternion[0] * startWeight +
      normalizedEndQuaternion[0] * endWeight,
    normalizedStartQuaternion[1] * startWeight +
      normalizedEndQuaternion[1] * endWeight,
    normalizedStartQuaternion[2] * startWeight +
      normalizedEndQuaternion[2] * endWeight,
    normalizedStartQuaternion[3] * startWeight +
      normalizedEndQuaternion[3] * endWeight,
  ];

  return canonicalizeQuaternionSign(interpolatedQuaternion);
}
