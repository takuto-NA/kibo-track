/**
 * Multi-face outlier re-solve and single-marker planar fallback for AprilCube pose.
 */
import {
  DEFAULT_RANSAC_REPROJECTION_ERROR_THRESHOLD_PX,
  MINIMUM_ESTIMATE_POSE_CORRESPONDENCE_COUNT,
} from "../pnp/constants.js";
import type { ImagePoint2D, ObjectPoint3D } from "../core/types.js";
import { estimatePose } from "../pnp/estimate-pose.js";
import type { EstimatePoseSuccess } from "../pnp/estimate-pose-types.js";
import { estimatePlanarPose } from "../pnp/planar/estimate-planar-pose.js";
import {
  buildAprilCubePoseSuccess,
  buildPlanarAprilCubePoseSuccess,
  refineAllCorrespondencesFromSeed,
} from "./aprilcube-pose-success.js";
import {
  buildMarkerCorrespondenceSlices,
  getUniqueMarkerIds,
  selectCorrespondencesByMarkerId,
} from "./correspondence-by-marker.js";
import {
  computeAprilCubeMarkerReprojectionDiagnostics,
  selectOutlierMarkerIds,
} from "./marker-outlier-resolver.js";
import {
  isPoseFacingCameraForMarkers,
  selectCameraFacingPlanarResult,
} from "./pose-facing-camera.js";
import type {
  AprilCubePoseMode,
  EstimateAprilCubePoseInput,
  EstimateAprilCubePoseOptions,
  EstimateAprilCubePoseResult,
  EstimateAprilCubePoseSuccess,
} from "./types.js";

function estimatePoseFromSingleMarkerPlanarSeeds(
  input: EstimateAprilCubePoseInput,
  imagePoints: ReadonlyArray<ImagePoint2D>,
  objectPoints: ReadonlyArray<ObjectPoint3D>,
  markerIds: ReadonlyArray<number>,
  options: EstimateAprilCubePoseOptions,
): EstimatePoseSuccess | null {
  let bestPoseResult: EstimatePoseSuccess | null = null;
  const markerSlices = buildMarkerCorrespondenceSlices(imagePoints, objectPoints, markerIds);

  for (const markerSlice of markerSlices) {
    const markerId = markerSlice.markerId;

    if (markerSlice.imagePoints.length < MINIMUM_ESTIMATE_POSE_CORRESPONDENCE_COUNT) {
      continue;
    }

    const planarResult = estimatePlanarPose(
      {
        imagePoints: markerSlice.imagePoints,
        objectPoints: markerSlice.objectPoints,
        cameraIntrinsics: input.cameraIntrinsics,
      },
      {
        maxRefinementIterations: options.maxRefinementIterations,
      },
    );
    const planarCandidates = planarResult.candidates ?? [];

    for (const planarCandidate of planarCandidates) {
      if (!isPoseFacingCameraForMarkers(input, [markerId], planarCandidate.pose)) {
        continue;
      }

      const refinedPoseResult = refineAllCorrespondencesFromSeed(
        input,
        imagePoints,
        objectPoints,
        planarCandidate.pose,
        options,
      );

      if (refinedPoseResult === null) {
        continue;
      }

      if (!isPoseFacingCameraForMarkers(input, markerIds, refinedPoseResult.pose)) {
        continue;
      }

      if (
        bestPoseResult === null ||
        refinedPoseResult.finalMeanReprojectionErrorPx <
          bestPoseResult.finalMeanReprojectionErrorPx
      ) {
        bestPoseResult = refinedPoseResult;
      }
    }
  }

  return bestPoseResult;
}

function estimateBestSingleMarkerFallback(
  input: EstimateAprilCubePoseInput,
  imagePoints: ReadonlyArray<ImagePoint2D>,
  objectPoints: ReadonlyArray<ObjectPoint3D>,
  markerIds: ReadonlyArray<number>,
  cornerIndices: ReadonlyArray<number>,
  options: EstimateAprilCubePoseOptions,
): EstimateAprilCubePoseSuccess | null {
  let bestFallbackResult: EstimateAprilCubePoseSuccess | null = null;

  for (const markerId of getUniqueMarkerIds(markerIds)) {
    const selectedCorrespondences = selectCorrespondencesByMarkerId(
      markerId,
      imagePoints,
      objectPoints,
      markerIds,
      cornerIndices,
    );

    if (selectedCorrespondences.imagePoints.length < MINIMUM_ESTIMATE_POSE_CORRESPONDENCE_COUNT) {
      continue;
    }

    const planarResult = estimatePlanarPose(
      {
        imagePoints: selectedCorrespondences.imagePoints,
        objectPoints: selectedCorrespondences.objectPoints,
        cameraIntrinsics: input.cameraIntrinsics,
      },
      {
        maxRefinementIterations: options.maxRefinementIterations,
      },
    );

    if (!planarResult.success) {
      continue;
    }

    const cameraFacingPlanarResult = selectCameraFacingPlanarResult(
      planarResult,
      input,
      selectedCorrespondences.markerIds,
    );

    if (cameraFacingPlanarResult === null) {
      continue;
    }

    const fallbackResult = buildPlanarAprilCubePoseSuccess(
      cameraFacingPlanarResult,
      input,
      selectedCorrespondences.markerIds,
      selectedCorrespondences.cornerIndices,
      selectedCorrespondences.imagePoints,
      selectedCorrespondences.objectPoints,
      options,
    );
    const rejectedMarkerIds = getUniqueMarkerIds(markerIds).filter(
      (candidateMarkerId) => candidateMarkerId !== markerId,
    );
    const fallbackWithRejectedMarkers = {
      ...fallbackResult,
      rejectedMarkerIds,
    };

    if (
      bestFallbackResult === null ||
      fallbackWithRejectedMarkers.finalMeanReprojectionErrorPx <
        bestFallbackResult.finalMeanReprojectionErrorPx
    ) {
      bestFallbackResult = fallbackWithRejectedMarkers;
    }
  }

  return bestFallbackResult;
}

/** Runs multi-face EPnP with optional outlier re-solve and single-marker fallback. */
export function estimateMultiFaceAprilCubePose(
  input: EstimateAprilCubePoseInput,
  imagePoints: ReadonlyArray<ImagePoint2D>,
  objectPoints: ReadonlyArray<ObjectPoint3D>,
  markerIds: ReadonlyArray<number>,
  cornerIndices: ReadonlyArray<number>,
  options: EstimateAprilCubePoseOptions,
  poseMode: AprilCubePoseMode,
  estimateAprilCubePose: (
    input: EstimateAprilCubePoseInput,
    options?: EstimateAprilCubePoseOptions,
  ) => EstimateAprilCubePoseResult,
): EstimateAprilCubePoseResult {
  const initialPoseResult = estimatePose(
    {
      imagePoints,
      objectPoints,
      cameraIntrinsics: input.cameraIntrinsics,
    },
    options,
  );

  if (!initialPoseResult.success) {
    return {
      success: false,
      stage: "poseEstimation",
      reason: initialPoseResult.reason,
    };
  }

  const seededPoseResult = estimatePoseFromSingleMarkerPlanarSeeds(
    input,
    imagePoints,
    objectPoints,
    markerIds,
    options,
  );
  const selectedPoseResult =
    seededPoseResult !== null &&
    seededPoseResult.finalMeanReprojectionErrorPx < initialPoseResult.finalMeanReprojectionErrorPx
      ? seededPoseResult
      : initialPoseResult;
  const reprojectionErrorThresholdPx =
    options.reprojectionErrorThresholdPx ?? DEFAULT_RANSAC_REPROJECTION_ERROR_THRESHOLD_PX;

  const markerDiagnostics = computeAprilCubeMarkerReprojectionDiagnostics(
    imagePoints,
    objectPoints,
    markerIds,
    selectedPoseResult.pose,
    input.cameraIntrinsics,
  );
  const outlierMarkerIds = selectOutlierMarkerIds(markerDiagnostics);

  if (outlierMarkerIds.length === 0) {
    if (selectedPoseResult.finalMeanReprojectionErrorPx > reprojectionErrorThresholdPx) {
      const singleMarkerFallbackResult = estimateBestSingleMarkerFallback(
        input,
        imagePoints,
        objectPoints,
        markerIds,
        cornerIndices,
        options,
      );

      if (
        singleMarkerFallbackResult !== null &&
        singleMarkerFallbackResult.finalMeanReprojectionErrorPx <
          selectedPoseResult.finalMeanReprojectionErrorPx
      ) {
        return singleMarkerFallbackResult;
      }
    }

    return buildAprilCubePoseSuccess(
      selectedPoseResult,
      input,
      imagePoints,
      objectPoints,
      markerIds,
      cornerIndices,
      poseMode,
      undefined,
      undefined,
      [],
    );
  }

  if (options.skipOutlierResolve === true) {
    return buildAprilCubePoseSuccess(
      selectedPoseResult,
      input,
      imagePoints,
      objectPoints,
      markerIds,
      cornerIndices,
      poseMode,
      undefined,
      undefined,
      outlierMarkerIds,
    );
  }

  const filteredMarkers = input.markers.filter(
    (marker) => !outlierMarkerIds.includes(marker.id),
  );

  const resolvedAprilCubeResult = estimateAprilCubePose(
    {
      markers: filteredMarkers,
      config: input.config,
      cameraIntrinsics: input.cameraIntrinsics,
    },
    {
      ...options,
      skipOutlierResolve: true,
    },
  );

  if (!resolvedAprilCubeResult.success) {
    return buildAprilCubePoseSuccess(
      selectedPoseResult,
      input,
      imagePoints,
      objectPoints,
      markerIds,
      cornerIndices,
      poseMode,
      undefined,
      undefined,
      outlierMarkerIds,
    );
  }

  return {
    ...resolvedAprilCubeResult,
    detectedMarkerCount: input.markers.length,
    rejectedMarkerIds: outlierMarkerIds,
  };
}
