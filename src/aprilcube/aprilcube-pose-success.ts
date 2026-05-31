/**
 * Builds AprilCube pose success payloads from core pose estimation results.
 */
import { computeMeasurementConfidence } from "../pnp/confidence.js";
import type { ImagePoint2D, ObjectPoint3D } from "../core/types.js";
import { DEFAULT_RANSAC_REPROJECTION_ERROR_THRESHOLD_PX } from "../pnp/constants.js";
import type { EstimatePoseSuccess } from "../pnp/estimate-pose-types.js";
import { classifyCorrespondenceInliers } from "../pnp/inlier-classification.js";
import { estimatePlanarPose } from "../pnp/planar/estimate-planar-pose.js";
import { refinePoseLM } from "../pnp/refine-pose-lm.js";
import { computeAprilCubeMarkerReprojectionDiagnostics } from "./marker-outlier-resolver.js";
import type {
  AprilCubeCornerDiagnostic,
  AprilCubePoseMode,
  EstimateAprilCubePoseInput,
  EstimateAprilCubePoseOptions,
  EstimateAprilCubePoseSuccess,
} from "./types.js";

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

function countUniqueMarkerIds(markerIds: ReadonlyArray<number>): number {
  return new Set(markerIds).size;
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

/** Builds the public AprilCube success payload from a core pose result. */
export function buildAprilCubePoseSuccess(
  poseResult: EstimatePoseSuccess,
  input: EstimateAprilCubePoseInput,
  imagePoints: ReadonlyArray<ImagePoint2D>,
  objectPoints: ReadonlyArray<ObjectPoint3D>,
  markerIds: ReadonlyArray<number>,
  cornerIndices: ReadonlyArray<number>,
  poseMode: AprilCubePoseMode,
  planarCandidateCount: number | undefined,
  planarAmbiguityScore: number | undefined,
  rejectedMarkerIds: ReadonlyArray<number>,
): EstimateAprilCubePoseSuccess {
  const markerReprojectionDiagnostics = computeAprilCubeMarkerReprojectionDiagnostics(
    imagePoints,
    objectPoints,
    markerIds,
    poseResult.pose,
    input.cameraIntrinsics,
  );

  return {
    ...poseResult,
    detectedMarkerCount: input.markers.length,
    correspondenceCount: imagePoints.length,
    correspondenceMarkerIds: markerIds,
    correspondenceCornerIndices: cornerIndices,
    outlierMarkerDiagnostics: buildOutlierMarkerDiagnostics(
      poseResult.outlierIndices,
      markerIds,
      cornerIndices,
    ),
    poseMode,
    visibleFaceCount: countUniqueMarkerIds(markerIds),
    detectedMarkerIds: input.markers.map((marker) => marker.id),
    planarCandidateCount,
    planarAmbiguityScore,
    markerReprojectionDiagnostics,
    rejectedMarkerIds,
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
  planarResult: Extract<ReturnType<typeof estimatePlanarPose>, { success: true }>,
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

  return buildAprilCubePoseSuccess(
    poseResult,
    input,
    imagePoints,
    objectPoints,
    markerIds,
    cornerIndices,
    "singleFacePlanar",
    planarResult.candidates.length,
    planarResult.planarAmbiguityScore,
    [],
  );
}
