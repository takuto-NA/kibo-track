/**
 * Public types for Levenberg-Marquardt pose refinement.
 */
import type {
  CameraIntrinsics,
  ImagePoint2D,
  ObjectPoint3D,
  Pose,
  PoseEstimationFailureReason,
  ReprojectionErrorSummary,
} from "../core/types.js";

/** Input correspondences and initial pose for LM refinement. */
export interface RefinePoseLMInput {
  readonly imagePoints: ReadonlyArray<ImagePoint2D>;
  readonly objectPoints: ReadonlyArray<ObjectPoint3D>;
  readonly cameraIntrinsics: CameraIntrinsics;
  readonly initialPose: Pose;
}

/** Optional Levenberg-Marquardt tuning parameters. */
export interface RefinePoseLMOptions {
  readonly maxIterations?: number;
  readonly jacobianStep?: number;
  readonly tolGradient?: number;
  readonly tolStep?: number;
  readonly tolResidual?: number;
  readonly lambdaInitial?: number;
}

/** Successful LM refinement with inspectable quality metrics. */
export interface RefinePoseLMSuccess {
  readonly success: true;
  readonly pose: Pose;
  readonly initialMeanReprojectionErrorPx: number;
  readonly finalMeanReprojectionErrorPx: number;
  readonly improvementRatio: number;
  readonly initialReprojectionError: ReprojectionErrorSummary;
  readonly finalReprojectionError: ReprojectionErrorSummary;
  readonly iterations: number;
  readonly converged: boolean;
  readonly finalResidualNorm: number;
}

/** Recoverable LM refinement failure. */
export interface RefinePoseLMFailure {
  readonly success: false;
  readonly reason: PoseEstimationFailureReason;
}

/** Result of refinePoseLM. */
export type RefinePoseLMResult = RefinePoseLMSuccess | RefinePoseLMFailure;
