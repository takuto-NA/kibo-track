/**
 * Shared validation for pinhole camera intrinsics.
 */
import type { CameraIntrinsics } from "./types.js";

/** Validates that camera intrinsics contain positive finite focal lengths. */
export function assertValidCameraIntrinsics(cameraIntrinsics: CameraIntrinsics): void {
  if (
    cameraIntrinsics.focalLengthX <= 0 ||
    cameraIntrinsics.focalLengthY <= 0
  ) {
    throw new RangeError("Camera focal lengths must be positive.");
  }

  if (
    !Number.isFinite(cameraIntrinsics.focalLengthX) ||
    !Number.isFinite(cameraIntrinsics.focalLengthY) ||
    !Number.isFinite(cameraIntrinsics.principalPointX) ||
    !Number.isFinite(cameraIntrinsics.principalPointY)
  ) {
    throw new RangeError("Camera intrinsics must contain finite numbers.");
  }
}
