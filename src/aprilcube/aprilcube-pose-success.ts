/**
 * Builds AprilCube pose success payloads from core pose estimation results.
 */
import { computeMeasurementConfidence } from "../pnp/confidence.js";
import { alignQuaternionSignToPrevious } from "../core/quaternion.js";
import type { ImagePoint2D, ObjectPoint3D, Pose } from "../core/types.js";
import { DEFAULT_RANSAC_REPROJECTION_ERROR_THRESHOLD_PX } from "../pnp/constants.js";
import type { EstimatePoseSuccess } from "../pnp/estimate-pose-types.js";
import { classifyCorrespondenceInliers } from "../pnp/inlier-classification.js";
import type { EstimatePlanarPoseSuccess } from "../pnp/planar/types.js";
import { refinePoseLM } from "../pnp/refine-pose-lm.js";
import { countUniqueMarkerIds } from "./correspondence-by-marker.js";
import { computeAprilCubeMarkerReprojectionDiagnostics } from "./marker-outlier-resolver.js";
import type {
  AprilCubeCornerDiagnostic,
  AprilCubePoseMode,
  EstimateAprilCubePoseInput,
  EstimateAprilCubePoseOptions,
  EstimateAprilCubePoseSuccess,
} from "./types.js";

export interface BuildAprilCubePoseSuccessContext {
  readonly poseResult: EstimatePoseSuccess;
  readonly input: EstimateAprilCubePoseInput;
  readonly imagePoints: ReadonlyArray<ImagePoint2D>;
  readonly objectPoints: ReadonlyArray<ObjectPoint3D>;
  readonly markerIds: ReadonlyArray<number>;
  readonly cornerIndices: ReadonlyArray<number>;
  readonly poseMode: AprilCubePoseMode;
  readonly planarCandidateCount?: number;
  readonly planarAmbiguityScore?: number;
  readonly rejectedMarkerIds: ReadonlyArray<number>;
  readonly previousPose?: Pose;
}

function buildOutlierMarkerDiagnostics(
  outlierIndices: ReadonlyArray<number>,
  correspondenceMarkerIds: ReadonlyArray<number>,
  correspondenceCornerIndices: ReadonlyArray<number>,
): AprilCubeCornerDiagnostic[] {
  return outlierIndices.map((correspondenceIndex) => {
    const markerId = correspondenceMarkerIds[correspondenceIndex];
    const cornerIndex = correspondenceCornerIndices[correspondenceIndex];

    if (markerId === undefined || cornerIndex === undefined) {
      throw new RangeError("Outlier correspondence metadata is missing.");
    }

    return {
      markerId,
      cornerIndex,
      correspondenceIndex,
    };
  });
}

function buildEstimatePoseSuccessFromClassification(
  pose: EstimatePoseSuccess["pose"],
  imagePoints: ReadonlyArray<ImagePoint2D>,
  objectPoints: ReadonlyArray<ObjectPoint3D>,
  input: EstimateAprilCubePoseInput,
  meanReprojectionErrorPx: number,
  initialMeanReprojectionErrorPx: number,
  finalMeanReprojectionErrorPx: number,
  iterations: number,
  reprojectionErrorThresholdPx: number,
): EstimatePoseSuccess {
  const classification = classifyCorrespondenceInliers(
    imagePoints,
    objectPoints,
    pose,
    input.cameraIntrinsics,
    reprojectionErrorThresholdPx,
  );
  const confidence = computeMeasurementConfidence({
    numInliers: classification.numInliers,
    totalPointCount: imagePoints.length,
    meanReprojectionErrorPx: finalMeanReprojectionErrorPx,
    reprojectionErrorThresholdPx,
  });

  return {
    success: true,
    pose,
    inlierIndices: classification.inlierIndices,
    outlierIndices: classification.outlierIndices,
    numInliers: classification.numInliers,
    inlierRatio: classification.inlierRatio,
    meanReprojectionErrorPx,
    confidence,
    initialMeanReprojectionErrorPx,
    finalMeanReprojectionErrorPx,
    iterations,
  };
}

function applyPreviousPoseRotationContinuity(
  poseResult: EstimatePoseSuccess,
  previousPose: Pose | undefined,
): EstimatePoseSuccess {
  if (previousPose === undefined) {
    return poseResult;
  }

  return {
    ...poseResult,
    pose: {
      rotation: alignQuaternionSignToPrevious(previousPose.rotation, poseResult.pose.rotation),
      translation: poseResult.pose.translation,
    },
  };
}

/** Builds the public AprilCube success payload from a core pose result. */
export function buildAprilCubePoseSuccess(
  context: BuildAprilCubePoseSuccessContext,
): EstimateAprilCubePoseSuccess {
  const continuousPoseResult = applyPreviousPoseRotationContinuity(
    context.poseResult,
    context.previousPose,
  );
  const markerReprojectionDiagnostics = computeAprilCubeMarkerReprojectionDiagnostics(
    context.imagePoints,
    context.objectPoints,
    context.markerIds,
    continuousPoseResult.pose,
    context.input.cameraIntrinsics,
  );

  return {
    ...continuousPoseResult,
    detectedMarkerCount: context.input.markers.length,
    correspondenceCount: context.imagePoints.length,
    correspondenceMarkerIds: context.markerIds,
    correspondenceCornerIndices: context.cornerIndices,
    outlierMarkerDiagnostics: buildOutlierMarkerDiagnostics(
      continuousPoseResult.outlierIndices,
      context.markerIds,
      context.cornerIndices,
    ),
    poseMode: context.poseMode,
    visibleFaceCount: countUniqueMarkerIds(context.markerIds),
    detectedMarkerIds: context.input.markers.map((marker) => marker.id),
    planarCandidateCount: context.planarCandidateCount,
    planarAmbiguityScore: context.planarAmbiguityScore,
    markerReprojectionDiagnostics,
    rejectedMarkerIds: context.rejectedMarkerIds,
  };
}

/** Refines a seed pose on all correspondences and returns a classified success result. */
export function refineAllCorrespondencesFromSeed(
  input: EstimateAprilCubePoseInput,
  imagePoints: ReadonlyArray<ImagePoint2D>,
  objectPoints: ReadonlyArray<ObjectPoint3D>,
  seedPose: EstimatePoseSuccess["pose"],
  options: EstimateAprilCubePoseOptions,
): EstimatePoseSuccess | null {
  const refinementResult = refinePoseLM(
    {
      imagePoints,
      objectPoints,
      cameraIntrinsics: input.cameraIntrinsics,
      initialPose: seedPose,
    },
    {
      maxIterations: options.maxRefinementIterations,
    },
  );

  if (!refinementResult.success) {
    return null;
  }

  const reprojectionErrorThresholdPx =
    options.reprojectionErrorThresholdPx ?? DEFAULT_RANSAC_REPROJECTION_ERROR_THRESHOLD_PX;

  return buildEstimatePoseSuccessFromClassification(
    refinementResult.pose,
    imagePoints,
    objectPoints,
    input,
    refinementResult.finalMeanReprojectionErrorPx,
    refinementResult.initialMeanReprojectionErrorPx,
    refinementResult.finalMeanReprojectionErrorPx,
    refinementResult.iterations,
    reprojectionErrorThresholdPx,
  );
}

/** Builds a single-face planar AprilCube success payload. */
export function buildPlanarAprilCubePoseSuccess(
  planarResult: EstimatePlanarPoseSuccess,
  input: EstimateAprilCubePoseInput,
  markerIds: ReadonlyArray<number>,
  cornerIndices: ReadonlyArray<number>,
  imagePoints: ReadonlyArray<ImagePoint2D>,
  objectPoints: ReadonlyArray<ObjectPoint3D>,
  options: EstimateAprilCubePoseOptions,
): EstimateAprilCubePoseSuccess {
  const reprojectionErrorThresholdPx =
    options.reprojectionErrorThresholdPx ?? DEFAULT_RANSAC_REPROJECTION_ERROR_THRESHOLD_PX;
  const poseResult = buildEstimatePoseSuccessFromClassification(
    planarResult.pose,
    imagePoints,
    objectPoints,
    input,
    planarResult.meanReprojectionErrorPx,
    planarResult.initialMeanReprojectionErrorPx,
    planarResult.finalMeanReprojectionErrorPx,
    planarResult.iterations,
    reprojectionErrorThresholdPx,
  );

  return buildAprilCubePoseSuccess({
    poseResult,
    input,
    imagePoints,
    objectPoints,
    markerIds,
    cornerIndices,
    poseMode: "singleFacePlanar",
    planarCandidateCount: planarResult.candidates.length,
    planarAmbiguityScore: planarResult.planarAmbiguityScore,
    rejectedMarkerIds: [],
    previousPose: options.previousPose,
  });
}
