/**
 * Public exports for the Kibo-track pose estimation core.
 */
export type {
  CameraIntrinsics,
  ImagePoint2D,
  ObjectPoint3D,
  Pose,
  PoseEstimationFailureReason,
  PoseEstimationResult,
  Quaternion,
  ReprojectionErrorSummary,
  RotationVector,
  RowMajorMatrix3,
  RowMajorMatrix4,
  Vector3,
} from "./core/types.js";

export { projectPoint, projectPoints } from "./core/project-points.js";
export {
  poseToMatrix4,
  transformObjectPointToCamera,
  transformObjectPointWithMatrix4,
} from "./core/pose-matrix.js";
export {
  alignQuaternionSignToPrevious,
  canonicalizeQuaternionSign,
  normalizeQuaternion,
  quaternionToRotationMatrix,
  rotationMatrixToQuaternion,
  slerpQuaternion,
} from "./core/quaternion.js";
export {
  quaternionToRotationVector,
  rodriguesToRotationMatrix,
  rotationMatrixToRodrigues,
  rotationVectorToQuaternion,
} from "./core/rodrigues.js";
export {
  meanReprojectionErrorPx,
  reprojectionError,
} from "./core/reprojection-error.js";

export type {
  RefinePoseLMFailure,
  RefinePoseLMInput,
  RefinePoseLMOptions,
  RefinePoseLMResult,
  RefinePoseLMSuccess,
} from "./pnp/types.js";

export { refinePoseLM } from "./pnp/refine-pose-lm.js";
