/**
 * Public types for the AprilCube adapter (v0.4).
 */
import type {
  CameraIntrinsics,
  ImagePoint2D,
  ObjectPoint3D,
  PoseEstimationFailureReason,
} from "../core/types.js";
import type {
  EstimatePoseOptions,
  EstimatePoseSuccess,
} from "../pnp/estimate-pose-types.js";

/** Cube face labels supported by the AprilCube adapter. */
export type AprilCubeFaceName =
  | "front"
  | "back"
  | "left"
  | "right"
  | "top"
  | "bottom";

/** Maps marker IDs to cube faces. */
export type AprilCubeFaceMap = Readonly<Record<number, AprilCubeFaceName>>;

/** Named detector corner order relative to the adapter canonical order. */
export type AprilCubeCornerOrderName =
  | "canonical"
  | "clockwiseRotate90"
  | "clockwiseRotate180"
  | "clockwiseRotate270"
  | "reverse";

/** AprilCube geometry and marker-to-face configuration. */
export interface AprilCubeConfig {
  readonly cubeSize: number;
  readonly faces: AprilCubeFaceMap;
  readonly cornerOrder?: AprilCubeCornerOrderName;
}

/** Detected marker corners from an external detector. */
export interface DetectedMarkerCorners {
  readonly id: number;
  readonly corners: ReadonlyArray<ImagePoint2D>;
}

/** Adapter-level recoverable failure reasons. */
export type AprilCubeAdapterFailureReason =
  | "invalidConfig"
  | "unknownMarkerId"
  | "duplicateMarkerId"
  | "invalidCornerCount"
  | "notEnoughCorners";

/** Successful AprilCube correspondence assembly. */
export interface AprilCubeCorrespondencesSuccess {
  readonly success: true;
  readonly imagePoints: ReadonlyArray<ImagePoint2D>;
  readonly objectPoints: ReadonlyArray<ObjectPoint3D>;
  readonly markerIds: ReadonlyArray<number>;
  readonly cornerIndices: ReadonlyArray<number>;
}

/** Failed AprilCube correspondence assembly. */
export interface AprilCubeCorrespondencesFailure {
  readonly success: false;
  readonly reason: AprilCubeAdapterFailureReason;
}

/** Result of buildAprilCubeCorrespondences. */
export type AprilCubeCorrespondencesResult =
  | AprilCubeCorrespondencesSuccess
  | AprilCubeCorrespondencesFailure;

/** Per-marker 3D corner map keyed by marker ID. */
export type AprilCubeObjectPointMap = Readonly<
  Record<number, ReadonlyArray<ObjectPoint3D>>
>;

/** Input for estimateAprilCubePose. */
export interface EstimateAprilCubePoseInput {
  readonly markers: ReadonlyArray<DetectedMarkerCorners>;
  readonly config: AprilCubeConfig;
  readonly cameraIntrinsics: CameraIntrinsics;
}

/** Successful AprilCube pose estimation with adapter metadata. */
export interface EstimateAprilCubePoseSuccess extends EstimatePoseSuccess {
  readonly detectedMarkerCount: number;
  readonly correspondenceCount: number;
  readonly correspondenceMarkerIds: ReadonlyArray<number>;
  readonly correspondenceCornerIndices: ReadonlyArray<number>;
  readonly outlierMarkerDiagnostics: ReadonlyArray<AprilCubeCornerDiagnostic>;
}

/** Identifies one correspondence by marker ID and corner index. */
export interface AprilCubeCornerDiagnostic {
  readonly markerId: number;
  readonly cornerIndex: number;
  readonly correspondenceIndex: number;
}

/** Failed AprilCube pose estimation at adapter or pose stage. */
export interface EstimateAprilCubePoseFailure {
  readonly success: false;
  readonly stage: "adapter" | "poseEstimation";
  readonly reason: AprilCubeAdapterFailureReason | PoseEstimationFailureReason;
}

/** Result of estimateAprilCubePose. */
export type EstimateAprilCubePoseResult =
  | EstimateAprilCubePoseSuccess
  | EstimateAprilCubePoseFailure;

/** Options forwarded to the underlying estimatePose call. */
export type EstimateAprilCubePoseOptions = EstimatePoseOptions;
