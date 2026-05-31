/**
 * Public domain types for Kibo-track pose estimation core.
 */

/** Pixel image coordinate `[u, v]` with origin at top-left. */
export type ImagePoint2D = readonly [number, number];

/** Object-space coordinate `[x, y, z]`. Units are caller-defined. */
export type ObjectPoint3D = readonly [number, number, number];

/** Translation vector `[x, y, z]`. */
export type Vector3 = readonly [number, number, number];

/** Rotation quaternion in `[x, y, z, w]` order. */
export type Quaternion = readonly [number, number, number, number];

/** OpenCV-style rotation vector `[rx, ry, rz]`. */
export type RotationVector = readonly [number, number, number];

/** Row-major 3x3 rotation matrix with column-vector math semantics. */
export type RowMajorMatrix3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/** Row-major 4x4 transform matrix with column-vector math semantics. */
export type RowMajorMatrix4 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/** Pinhole camera intrinsics in pixel units. */
export interface CameraIntrinsics {
  readonly focalLengthX: number;
  readonly focalLengthY: number;
  readonly principalPointX: number;
  readonly principalPointY: number;
}

/** cameraFromObject pose with quaternion rotation and translation. */
export interface Pose {
  readonly rotation: Quaternion;
  readonly translation: Vector3;
}

/** Failure reason for pose estimation operations (reserved for v0.3+). */
export type PoseEstimationFailureReason =
  | "notEnoughPoints"
  | "notEnoughInliers"
  | "degenerateConfiguration"
  | "invalidInput";

/** Result-style API shape for recoverable estimation failures (reserved for v0.3+). */
export type PoseEstimationResult<TSuccess> =
  | {
      readonly success: true;
      readonly value: TSuccess;
    }
  | {
      readonly success: false;
      readonly reason: PoseEstimationFailureReason;
    };

/** Per-point and aggregate reprojection error in pixel space. */
export interface ReprojectionErrorSummary {
  readonly perPointErrorsPx: ReadonlyArray<number>;
  readonly meanErrorPx: number;
}
