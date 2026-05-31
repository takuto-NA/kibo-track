/**
 * Shared numeric tolerances for Kibo-track geometry and pose tests.
 */
export const ANGLE_TOLERANCE_RADIANS = 1e-6;

export const ROTATION_MATRIX_TOLERANCE = 1e-6;

export const QUATERNION_TOLERANCE = 1e-6;

export const PROJECTION_TOLERANCE_PX = 1e-6;

export const REPROJECTION_ERROR_TOLERANCE_PX = 1e-6;

export const VECTOR_LENGTH_EPSILON = 1e-12;

export const ROTATION_VECTOR_ANGLE_EPSILON = 1e-12;

export const IDENTITY_MATRIX3: readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
] = [1, 0, 0, 0, 1, 0, 0, 0, 1];
