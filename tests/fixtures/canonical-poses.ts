/**
 * Canonical quaternion and matrix fixtures for sign and layout diagnostics.
 */
import type { Pose, Quaternion, RowMajorMatrix4 } from "../../src/core/types.js";

export const POSITIVE_W_QUATERNION: Quaternion = [0, 0, 0, 1];

export const NEGATIVE_W_EQUIVALENT_QUATERNION: Quaternion = [0, 0, 0, -1];

export const PREVIOUS_FRAME_QUATERNION: Quaternion = [0.1, 0.2, 0.3, 0.9];

export const CURRENT_FRAME_OPPOSITE_SIGN_QUATERNION: Quaternion = [
  -0.1, -0.2, -0.3, -0.9,
];

/** 90-degree rotation about +Y in camera frame (rvec = [0, pi/2, 0]). */
export const NINETY_DEGREE_Y_AXIS_ROTATION_VECTOR: readonly [number, number, number] =
  [0, Math.PI / 2, 0];

export const TRANSLATION_ONE_METER_ALONG_Z: readonly [number, number, number] = [
  0, 0, 1,
];

export const POSE_WITH_Y_AXIS_ROTATION: Pose = {
  rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2],
  translation: TRANSLATION_ONE_METER_ALONG_Z,
};

/** Expected row-major indices for identity 4x4 matrix. */
export const EXPECTED_IDENTITY_MATRIX4: RowMajorMatrix4 = [
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
];
