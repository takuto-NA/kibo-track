/**
 * Normalizes pixel image points using pinhole camera intrinsics.
 */
import type { CameraIntrinsics, ImagePoint2D } from "../../core/types.js";
import type { NormalizedImagePoint2D } from "./types.js";

/** Converts pixel coordinates to normalized camera coordinates. */
export function normalizeImagePoints(
  imagePoints: ReadonlyArray<ImagePoint2D>,
  cameraIntrinsics: CameraIntrinsics,
): NormalizedImagePoint2D[] {
  return imagePoints.map((imagePoint) => [
    (imagePoint[0] - cameraIntrinsics.principalPointX) / cameraIntrinsics.focalLengthX,
    (imagePoint[1] - cameraIntrinsics.principalPointY) / cameraIntrinsics.focalLengthY,
  ]);
}
