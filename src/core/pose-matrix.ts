/**
 * cameraFromObject pose to row-major 4x4 matrix conversion.
 */
import { transformObjectPointWithRotationMatrix } from "./matrix3.js";
import { quaternionToRotationMatrix } from "./quaternion.js";
import type { ObjectPoint3D, Pose, RowMajorMatrix4, Vector3 } from "./types.js";

/** Builds a row-major 4x4 cameraFromObject transform matrix. */
export function poseToMatrix4(cameraFromObjectPose: Pose): RowMajorMatrix4 {
  const rotationMatrix = quaternionToRotationMatrix(cameraFromObjectPose.rotation);
  const [translationX, translationY, translationZ] = cameraFromObjectPose.translation;

  return [
    rotationMatrix[0]!,
    rotationMatrix[1]!,
    rotationMatrix[2]!,
    translationX,
    rotationMatrix[3]!,
    rotationMatrix[4]!,
    rotationMatrix[5]!,
    translationY,
    rotationMatrix[6]!,
    rotationMatrix[7]!,
    rotationMatrix[8]!,
    translationZ,
    0,
    0,
    0,
    1,
  ];
}

/** Transforms an object-space point into camera-space using a 4x4 matrix. */
export function transformObjectPointWithMatrix4(
  objectPoint: ObjectPoint3D,
  cameraFromObjectMatrix: RowMajorMatrix4,
): Vector3 {
  const [objectX, objectY, objectZ] = objectPoint;

  const cameraX =
    cameraFromObjectMatrix[0]! * objectX +
    cameraFromObjectMatrix[1]! * objectY +
    cameraFromObjectMatrix[2]! * objectZ +
    cameraFromObjectMatrix[3]!;
  const cameraY =
    cameraFromObjectMatrix[4]! * objectX +
    cameraFromObjectMatrix[5]! * objectY +
    cameraFromObjectMatrix[6]! * objectZ +
    cameraFromObjectMatrix[7]!;
  const cameraZ =
    cameraFromObjectMatrix[8]! * objectX +
    cameraFromObjectMatrix[9]! * objectY +
    cameraFromObjectMatrix[10]! * objectZ +
    cameraFromObjectMatrix[11]!;

  return [cameraX, cameraY, cameraZ];
}

/** Transforms an object-space point into camera-space using a pose. */
export function transformObjectPointToCamera(
  objectPoint: ObjectPoint3D,
  cameraFromObjectPose: Pose,
): Vector3 {
  const rotationMatrix = quaternionToRotationMatrix(cameraFromObjectPose.rotation);
  const [translationX, translationY, translationZ] = cameraFromObjectPose.translation;
  const [objectX, objectY, objectZ] = objectPoint;

  return transformObjectPointWithRotationMatrix(
    objectX,
    objectY,
    objectZ,
    rotationMatrix,
    translationX,
    translationY,
    translationZ,
  );
}
