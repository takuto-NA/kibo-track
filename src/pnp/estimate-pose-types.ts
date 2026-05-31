/**
 * Public types for v0.3 initial pose estimation via estimatePose.
 */
import type {
  CameraIntrinsics,
  ImagePoint2D,
  ObjectPoint3D,
  Pose,
  PoseEstimationFailureReason,
} from "../core/types.js";

/** Input correspondences for estimatePose without an initial pose. */
export interface EstimatePoseInput {
  readonly imagePoints: ReadonlyArray<ImagePoint2D>;
  readonly objectPoints: ReadonlyArray<ObjectPoint3D>;
  readonly cameraIntrinsics: CameraIntrinsics;
}

/** Optional estimatePose tuning parameters. */
export interface EstimatePoseOptions {
  /** When false, skip RANSAC and run EPnP + LM on all points (deterministic tests). */
  readonly enableRansac?: boolean;
  readonly maxRansacIterations?: number;
  readonly reprojectionErrorThresholdPx?: number;
  readonly desiredRansacConfidence?: number;
  readonly minimumInlierCount?: number;
  /** Optional seed for deterministic RANSAC sampling in tests. */
  readonly randomSeed?: number;
  readonly maxRefinementIterations?: number;
  /** Optional previous pose used for planar disambiguation (AprilCube adapter). */
  readonly previousPose?: import("../core/types.js").Pose;
  /** Internal: skip one-pass marker outlier re-solve (prevents recursion). */
  readonly skipOutlierResolve?: boolean;
}

/** Successful pose measurement with inspectable quality metrics. */
export interface EstimatePoseSuccess {
  readonly success: true;
  readonly pose: Pose;
  readonly inlierIndices: ReadonlyArray<number>;
  readonly outlierIndices: ReadonlyArray<number>;
  readonly numInliers: number;
  readonly inlierRatio: number;
  readonly meanReprojectionErrorPx: number;
  readonly confidence: number;
  readonly initialMeanReprojectionErrorPx: number;
  readonly finalMeanReprojectionErrorPx: number;
  readonly iterations: number;
}

/** Recoverable estimatePose failure. */
export interface EstimatePoseFailure {
  readonly success: false;
  readonly reason: PoseEstimationFailureReason;
}

/** Result of estimatePose. */
export type EstimatePoseResult = EstimatePoseSuccess | EstimatePoseFailure;
