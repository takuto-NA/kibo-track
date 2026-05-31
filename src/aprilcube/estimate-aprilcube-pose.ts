/**
 * Estimates AprilCube pose by composing correspondences with estimatePose.
 */
import { estimatePose } from "../pnp/estimate-pose.js";
import { buildAprilCubeCorrespondences } from "./build-correspondences.js";
import type {
  AprilCubeCornerDiagnostic,
  EstimateAprilCubePoseInput,
  EstimateAprilCubePoseOptions,
  EstimateAprilCubePoseResult,
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

/** Estimates cameraFromObject pose from detected AprilCube marker corners. */
export function estimateAprilCubePose(
  input: EstimateAprilCubePoseInput,
  options: EstimateAprilCubePoseOptions = {},
): EstimateAprilCubePoseResult {
  const correspondenceResult = buildAprilCubeCorrespondences(
    input.markers,
    input.config,
  );

  if (!correspondenceResult.success) {
    return {
      success: false,
      stage: "adapter",
      reason: correspondenceResult.reason,
    };
  }

  const poseResult = estimatePose(
    {
      imagePoints: correspondenceResult.imagePoints,
      objectPoints: correspondenceResult.objectPoints,
      cameraIntrinsics: input.cameraIntrinsics,
    },
    options,
  );

  if (!poseResult.success) {
    return {
      success: false,
      stage: "poseEstimation",
      reason: poseResult.reason,
    };
  }

  return {
    ...poseResult,
    detectedMarkerCount: input.markers.length,
    correspondenceCount: correspondenceResult.imagePoints.length,
    correspondenceMarkerIds: correspondenceResult.markerIds,
    correspondenceCornerIndices: correspondenceResult.cornerIndices,
    outlierMarkerDiagnostics: buildOutlierMarkerDiagnostics(
      poseResult.outlierIndices,
      correspondenceResult.markerIds,
      correspondenceResult.cornerIndices,
    ),
  };
}
