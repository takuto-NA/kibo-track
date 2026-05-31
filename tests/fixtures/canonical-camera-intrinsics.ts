/**
 * Canonical test camera intrinsics and object points for convention diagnostics.
 */
import type { CameraIntrinsics, ObjectPoint3D, Pose } from "../../src/core/types.js";

export const CANONICAL_FOCAL_LENGTH_PX = 800;

export const CANONICAL_PRINCIPAL_POINT_X_PX = 640;

export const CANONICAL_PRINCIPAL_POINT_Y_PX = 360;

export const CANONICAL_CAMERA_INTRINSICS: CameraIntrinsics = {
  focalLengthX: CANONICAL_FOCAL_LENGTH_PX,
  focalLengthY: CANONICAL_FOCAL_LENGTH_PX,
  principalPointX: CANONICAL_PRINCIPAL_POINT_X_PX,
  principalPointY: CANONICAL_PRINCIPAL_POINT_Y_PX,
};

/** Identity cameraFromObject pose: object origin at camera origin looking down +Z. */
export const IDENTITY_CAMERA_FROM_OBJECT_POSE: Pose = {
  rotation: [0, 0, 0, 1],
  translation: [0, 0, 0],
};

/** Object point one meter in front of the camera along +Z in camera frame. */
export const OBJECT_POINT_ONE_METER_FORWARD: ObjectPoint3D = [0, 0, 1];

/** Object point one meter to the camera-right along +X in camera frame. */
export const OBJECT_POINT_ONE_METER_RIGHT: ObjectPoint3D = [1, 0, 1];

/** Object point one meter downward along +Y in camera frame. */
export const OBJECT_POINT_ONE_METER_DOWN: ObjectPoint3D = [0, 1, 1];

/** Expected projection of the forward point at unit depth. */
export const EXPECTED_FORWARD_POINT_AT_UNIT_DEPTH: readonly [number, number] = [
  CANONICAL_PRINCIPAL_POINT_X_PX,
  CANONICAL_PRINCIPAL_POINT_Y_PX,
];

/** Expected projection offset when +X increases u. */
export const EXPECTED_RIGHT_POINT_U_OFFSET_PX = CANONICAL_FOCAL_LENGTH_PX;

/** Expected projection offset when +Y increases v. */
export const EXPECTED_DOWN_POINT_V_OFFSET_PX = CANONICAL_FOCAL_LENGTH_PX;

/** Depth used for axis convention tests. */
export const AXIS_TEST_DEPTH_METERS = 1;
