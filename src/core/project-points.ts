/**
 * Pinhole projection of 3D object points into pixel image coordinates.
 */
import { transformObjectPointToCamera } from "./pose-matrix.js";
import type {
  CameraIntrinsics,
  ImagePoint2D,
  ObjectPoint3D,
  Pose,
} from "./types.js";
import { assertValidCameraIntrinsics } from "./validate-camera-intrinsics.js";

const MINIMUM_POSITIVE_DEPTH = Number.EPSILON;

function projectCameraPointToImage(
  cameraPointX: number,
  cameraPointY: number,
  cameraPointZ: number,
  cameraIntrinsics: CameraIntrinsics,
): ImagePoint2D {
  // Guard: points behind or on the camera plane cannot be projected.
  if (cameraPointZ <= MINIMUM_POSITIVE_DEPTH) {
    throw new RangeError("Camera-space depth must be positive for projection.");
  }

  const imageU =
    cameraIntrinsics.focalLengthX * (cameraPointX / cameraPointZ) +
    cameraIntrinsics.principalPointX;
  const imageV =
    cameraIntrinsics.focalLengthY * (cameraPointY / cameraPointZ) +
    cameraIntrinsics.principalPointY;

  return [imageU, imageV];
}

function projectObjectPointToImage(
  objectPoint: ObjectPoint3D,
  cameraFromObjectPose: Pose,
  cameraIntrinsics: CameraIntrinsics,
): ImagePoint2D {
  const [cameraPointX, cameraPointY, cameraPointZ] = transformObjectPointToCamera(
    objectPoint,
    cameraFromObjectPose,
  );

  return projectCameraPointToImage(
    cameraPointX,
    cameraPointY,
    cameraPointZ,
    cameraIntrinsics,
  );
}

/** Projects object-space 3D points to pixel image coordinates. */
export function projectPoints(
  objectPoints: ReadonlyArray<ObjectPoint3D>,
  cameraFromObjectPose: Pose,
  cameraIntrinsics: CameraIntrinsics,
): ImagePoint2D[] {
  assertValidCameraIntrinsics(cameraIntrinsics);

  return objectPoints.map((objectPoint) =>
    projectObjectPointToImage(objectPoint, cameraFromObjectPose, cameraIntrinsics),
  );
}

/** Projects a single object-space point to pixel image coordinates. */
export function projectPoint(
  objectPoint: ObjectPoint3D,
  cameraFromObjectPose: Pose,
  cameraIntrinsics: CameraIntrinsics,
): ImagePoint2D {
  assertValidCameraIntrinsics(cameraIntrinsics);
  return projectObjectPointToImage(
    objectPoint,
    cameraFromObjectPose,
    cameraIntrinsics,
  );
}
