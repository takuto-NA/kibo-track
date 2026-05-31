/**
 * Per-marker planar pose attempts shared by multi-face seeding and single-marker fallback.
 */
import { MINIMUM_ESTIMATE_POSE_CORRESPONDENCE_COUNT } from "../pnp/constants.js";
import type { ImagePoint2D, ObjectPoint3D } from "../core/types.js";
import type { EstimatePoseSuccess } from "../pnp/estimate-pose-types.js";
import { estimatePlanarPose } from "../pnp/planar/estimate-planar-pose.js";
import type { EstimatePlanarPoseResult } from "../pnp/planar/types.js";
import {
  buildPlanarAprilCubePoseSuccess,
  refineAllCorrespondencesFromSeed,
} from "./aprilcube-pose-success.js";
import {
  buildMarkerCorrespondenceSlices,
  getUniqueMarkerIds,
  toSelectedMarkerCorrespondences,
  type MarkerCorrespondenceSlice,
} from "./correspondence-by-marker.js";
import { isPoseFacingCameraForMarkers, selectCameraFacingPlanarResult } from "./pose-facing-camera.js";
import type {
  EstimateAprilCubePoseInput,
  EstimateAprilCubePoseOptions,
  EstimateAprilCubePoseSuccess,
} from "./types.js";

function markerSliceHasMinimumCorrespondences(markerSlice: MarkerCorrespondenceSlice): boolean {
  return markerSlice.imagePoints.length >= MINIMUM_ESTIMATE_POSE_CORRESPONDENCE_COUNT;
}

function estimatePlanarPoseForMarkerSlice(
  input: EstimateAprilCubePoseInput,
  markerSlice: MarkerCorrespondenceSlice,
  options: EstimateAprilCubePoseOptions,
): EstimatePlanarPoseResult {
  return estimatePlanarPose(
    {
      imagePoints: markerSlice.imagePoints,
      objectPoints: markerSlice.objectPoints,
      cameraIntrinsics: input.cameraIntrinsics,
    },
    {
      previousPose: options.previousPose,
      maxRefinementIterations: options.maxRefinementIterations,
    },
  );
}

function isBetterReprojectionErrorPx(
  candidateErrorPx: number,
  bestErrorPx: number | null,
): boolean {
  return bestErrorPx === null || candidateErrorPx < bestErrorPx;
}

/** Tries planar seeds per marker, refining the best on all correspondences. */
export function estimateBestPlanarSeedForMultiFace(
  input: EstimateAprilCubePoseInput,
  imagePoints: ReadonlyArray<ImagePoint2D>,
  objectPoints: ReadonlyArray<ObjectPoint3D>,
  markerIds: ReadonlyArray<number>,
  options: EstimateAprilCubePoseOptions,
): EstimatePoseSuccess | null {
  let bestPoseResult: EstimatePoseSuccess | null = null;
  const markerSlices = buildMarkerCorrespondenceSlices(imagePoints, objectPoints, markerIds);

  for (const markerSlice of markerSlices) {
    if (!markerSliceHasMinimumCorrespondences(markerSlice)) {
      continue;
    }

    const planarResult = estimatePlanarPoseForMarkerSlice(input, markerSlice, options);
    const planarCandidates = planarResult.candidates ?? [];

    for (const planarCandidate of planarCandidates) {
      if (!isPoseFacingCameraForMarkers(input, [markerSlice.markerId], planarCandidate.pose)) {
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
        isBetterReprojectionErrorPx(
          refinedPoseResult.finalMeanReprojectionErrorPx,
          bestPoseResult?.finalMeanReprojectionErrorPx ?? null,
        )
      ) {
        bestPoseResult = refinedPoseResult;
      }
    }
  }

  return bestPoseResult;
}

/** Falls back to the best single-marker planar pose when multi-face EPnP is weak. */
export function estimateBestSingleMarkerPlanarFallback(
  input: EstimateAprilCubePoseInput,
  imagePoints: ReadonlyArray<ImagePoint2D>,
  objectPoints: ReadonlyArray<ObjectPoint3D>,
  markerIds: ReadonlyArray<number>,
  cornerIndices: ReadonlyArray<number>,
  options: EstimateAprilCubePoseOptions,
): EstimateAprilCubePoseSuccess | null {
  let bestFallbackResult: EstimateAprilCubePoseSuccess | null = null;
  const uniqueMarkerIds = getUniqueMarkerIds(markerIds);
  const markerSlices = buildMarkerCorrespondenceSlices(
    imagePoints,
    objectPoints,
    markerIds,
    cornerIndices,
  );

  for (const markerSlice of markerSlices) {
    if (!markerSliceHasMinimumCorrespondences(markerSlice)) {
      continue;
    }

    const planarResult = estimatePlanarPoseForMarkerSlice(input, markerSlice, options);

    if (!planarResult.success) {
      continue;
    }

    const selectedCorrespondences = toSelectedMarkerCorrespondences(markerSlice);
    const cameraFacingPlanarResult = selectCameraFacingPlanarResult(
      planarResult,
      input,
      selectedCorrespondences.markerIds,
      options.previousPose,
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
    const rejectedMarkerIds = uniqueMarkerIds.filter(
      (candidateMarkerId) => candidateMarkerId !== markerSlice.markerId,
    );
    const fallbackWithRejectedMarkers = {
      ...fallbackResult,
      rejectedMarkerIds,
    };

    if (
      isBetterReprojectionErrorPx(
        fallbackWithRejectedMarkers.finalMeanReprojectionErrorPx,
        bestFallbackResult?.finalMeanReprojectionErrorPx ?? null,
      )
    ) {
      bestFallbackResult = fallbackWithRejectedMarkers;
    }
  }

  return bestFallbackResult;
}
