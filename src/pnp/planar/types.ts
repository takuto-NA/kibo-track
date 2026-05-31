/**
 * Types for homography-based planar pose estimation.
 */
import type {
  CameraIntrinsics,
  ImagePoint2D,
  ObjectPoint3D,
  Pose,
} from "../../core/types.js";

/** Input for planar pose estimation from coplanar correspondences. */
export interface EstimatePlanarPoseInput {
  readonly imagePoints: ReadonlyArray<ImagePoint2D>;
  readonly objectPoints: ReadonlyArray<ObjectPoint3D>;
  readonly cameraIntrinsics: CameraIntrinsics;
}

/** Options for planar pose estimation and disambiguation. */
export interface EstimatePlanarPoseOptions {
  readonly previousPose?: Pose;
  readonly maxRefinementIterations?: number;
}

/** One planar pose candidate with reprojection quality. */
export interface PlanarPoseCandidate {
  readonly pose: Pose;
  readonly meanReprojectionErrorPx: number;
  readonly initialMeanReprojectionErrorPx: number;
  readonly finalMeanReprojectionErrorPx: number;
  readonly iterations: number;
}

/** Successful planar pose estimation. */
export interface EstimatePlanarPoseSuccess {
  readonly success: true;
  readonly pose: Pose;
  readonly candidates: ReadonlyArray<PlanarPoseCandidate>;
  readonly selectedCandidateIndex: number;
  readonly planarAmbiguityScore: number;
  readonly meanReprojectionErrorPx: number;
  readonly initialMeanReprojectionErrorPx: number;
  readonly finalMeanReprojectionErrorPx: number;
  readonly iterations: number;
}

/** Recoverable planar pose failure. */
export interface EstimatePlanarPoseFailure {
  readonly success: false;
  readonly reason: "notEnoughPoints" | "degenerateConfiguration" | "planarAmbiguous";
  readonly candidates?: ReadonlyArray<PlanarPoseCandidate>;
  readonly planarAmbiguityScore?: number;
}

/** Result of estimatePlanarPose. */
export type EstimatePlanarPoseResult =
  | EstimatePlanarPoseSuccess
  | EstimatePlanarPoseFailure;

/** Plane basis and 2D coordinates for coplanar object points. */
export interface CoplanarPlaneBasis {
  readonly origin: ObjectPoint3D;
  readonly axisU: readonly [number, number, number];
  readonly axisV: readonly [number, number, number];
  readonly axisNormal: readonly [number, number, number];
  readonly planeCoordinates2D: ReadonlyArray<readonly [number, number]>;
}

/** Normalized image coordinates in camera frame (u - cx) / fx. */
export type NormalizedImagePoint2D = readonly [number, number];

/** Row-major 3x3 homography matrix. */
export type HomographyMatrix3x3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];
