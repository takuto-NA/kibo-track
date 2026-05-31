/**
 * Multi-face outlier re-solve and single-marker planar fallback for AprilCube pose.
 */
import type { ImagePoint2D, ObjectPoint3D } from "../core/types.js";
import { estimatePose } from "../pnp/estimate-pose.js";
import { buildAprilCubeCorrespondences } from "./build-correspondences.js";
import { routeAprilCubePoseFromCorrespondences } from "./aprilcube-pose-routing.js";
import { buildAprilCubePoseSuccess } from "./aprilcube-pose-success.js";
import {
  computeAprilCubeMarkerReprojectionDiagnostics,
  selectOutlierMarkerIds,
} from "./marker-outlier-resolver.js";
import { resolveMultiFaceReprojectionErrorThresholdPx } from "./pose-policy.js";
import {
  estimateBestPlanarSeedForMultiFace,
  estimateBestSingleMarkerPlanarFallback,
} from "./single-marker-planar-pose.js";
import type {
  AprilCubePoseMode,
  EstimateAprilCubePoseInput,
  EstimateAprilCubePoseOptions,
  EstimateAprilCubePoseResult,
} from "./types.js";

function buildMultiFaceSuccessPayload(
  input: EstimateAprilCubePoseInput,
  imagePoints: ReadonlyArray<ImagePoint2D>,
  objectPoints: ReadonlyArray<ObjectPoint3D>,
  markerIds: ReadonlyArray<number>,
  cornerIndices: ReadonlyArray<number>,
  poseMode: AprilCubePoseMode,
  rejectedMarkerIds: ReadonlyArray<number>,
  options: EstimateAprilCubePoseOptions,
  selectedPoseResult: Extract<ReturnType<typeof estimatePose>, { success: true }>,
) {
  return buildAprilCubePoseSuccess({
    poseResult: selectedPoseResult,
    input,
    imagePoints,
    objectPoints,
    markerIds,
    cornerIndices,
    poseMode,
    rejectedMarkerIds,
    previousPose: options.previousPose,
  });
}

function resolveAprilCubePoseAfterOutlierRemoval(
  input: EstimateAprilCubePoseInput,
  filteredMarkers: EstimateAprilCubePoseInput["markers"],
  options: EstimateAprilCubePoseOptions,
): EstimateAprilCubePoseResult | null {
  const filteredCorrespondenceResult = buildAprilCubeCorrespondences(
    filteredMarkers,
    input.config,
  );

  if (!filteredCorrespondenceResult.success) {
    return null;
  }

  return routeAprilCubePoseFromCorrespondences(
    {
      markers: filteredMarkers,
      config: input.config,
      cameraIntrinsics: input.cameraIntrinsics,
    },
    filteredCorrespondenceResult,
    {
      ...options,
      skipOutlierResolve: true,
    },
  );
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

  const seededPoseResult = estimateBestPlanarSeedForMultiFace(
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
  const reprojectionErrorThresholdPx = resolveMultiFaceReprojectionErrorThresholdPx(options);

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
      const singleMarkerFallbackResult = estimateBestSingleMarkerPlanarFallback(
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

    return buildMultiFaceSuccessPayload(
      input,
      imagePoints,
      objectPoints,
      markerIds,
      cornerIndices,
      poseMode,
      [],
      options,
      selectedPoseResult,
    );
  }

  if (options.skipOutlierResolve === true) {
    return buildMultiFaceSuccessPayload(
      input,
      imagePoints,
      objectPoints,
      markerIds,
      cornerIndices,
      poseMode,
      outlierMarkerIds,
      options,
      selectedPoseResult,
    );
  }

  const filteredMarkers = input.markers.filter(
    (marker) => !outlierMarkerIds.includes(marker.id),
  );
  const resolvedAprilCubeResult = resolveAprilCubePoseAfterOutlierRemoval(
    input,
    filteredMarkers,
    options,
  );

  if (resolvedAprilCubeResult === null || !resolvedAprilCubeResult.success) {
    return buildMultiFaceSuccessPayload(
      input,
      imagePoints,
      objectPoints,
      markerIds,
      cornerIndices,
      poseMode,
      outlierMarkerIds,
      options,
      selectedPoseResult,
    );
  }

  return {
    ...resolvedAprilCubeResult,
    detectedMarkerCount: input.markers.length,
    rejectedMarkerIds: outlierMarkerIds,
  };
}
