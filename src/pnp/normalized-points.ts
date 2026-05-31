/**
 * Converts pixel image points to normalized camera coordinates for EPnP.
 */
import type { CameraIntrinsics, ImagePoint2D } from "../core/types.js";

/** Normalized camera coordinate `[x, y]` with z implicitly 1. */
export type NormalizedCameraPoint2D = readonly [number, number];

/** Converts one pixel image point to normalized camera coordinates. */
export function imagePointToNormalizedCameraCoordinate(
  imagePoint: ImagePoint2D,
  cameraIntrinsics: CameraIntrinsics,
): NormalizedCameraPoint2D {
  const normalizedX =
    (imagePoint[0] - cameraIntrinsics.principalPointX) / cameraIntrinsics.focalLengthX;
  const normalizedY =
    (imagePoint[1] - cameraIntrinsics.principalPointY) / cameraIntrinsics.focalLengthY;

  return [normalizedX, normalizedY];
}

/** Converts pixel image points to normalized camera coordinates. */
export function imagePointsToNormalizedCameraCoordinates(
  imagePoints: ReadonlyArray<ImagePoint2D>,
  cameraIntrinsics: CameraIntrinsics,
): NormalizedCameraPoint2D[] {
  return imagePoints.map((imagePoint) =>
    imagePointToNormalizedCameraCoordinate(imagePoint, cameraIntrinsics),
  );
}
