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

export type {
  EstimatePoseFailure,
  EstimatePoseInput,
  EstimatePoseOptions,
  EstimatePoseResult,
  EstimatePoseSuccess,
} from "./pnp/estimate-pose-types.js";

export { refinePoseLM } from "./pnp/refine-pose-lm.js";
export { estimatePose } from "./pnp/estimate-pose.js";

export type {
  AprilCubeAdapterFailureReason,
  AprilCubeConfig,
  AprilCubeCornerDiagnostic,
  AprilCubeCornerOrderName,
  AprilCubeCorrespondencesFailure,
  AprilCubeCorrespondencesResult,
  AprilCubeCorrespondencesSuccess,
  AprilCubeFaceMap,
  AprilCubeFaceName,
  AprilCubeObjectPointMap,
  DetectedMarkerCorners,
  EstimateAprilCubePoseFailure,
  EstimateAprilCubePoseInput,
  EstimateAprilCubePoseOptions,
  EstimateAprilCubePoseResult,
  EstimateAprilCubePoseSuccess,
} from "./aprilcube/types.js";

export { buildAprilCubeCorrespondences } from "./aprilcube/build-correspondences.js";
export { buildAprilCubeObjectPointMap } from "./aprilcube/build-object-point-map.js";
export { buildFaceObjectCorners } from "./aprilcube/cube-corners.js";
export { estimateAprilCubePose } from "./aprilcube/estimate-aprilcube-pose.js";
export { isValidAprilCubeConfig } from "./aprilcube/validate-config.js";
