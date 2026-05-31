/**
 * Unit tests for AprilCube per-marker outlier re-solve helpers.
 */
import { describe, expect, it } from "vitest";
import { buildAprilCubeCorrespondences } from "../../src/aprilcube/build-correspondences.js";
import {
  computeAprilCubeMarkerReprojectionDiagnostics,
  selectOutlierMarkerIds,
} from "../../src/aprilcube/marker-outlier-resolver.js";
import { estimateAprilCubePose } from "../../src/aprilcube/estimate-aprilcube-pose.js";
import {
  CANONICAL_CAMERA_INTRINSICS,
  STANDARD_APRILCUBE_CONFIG,
  createProjectedAprilCubeMarkers,
  injectBadCornerOnFirstMarker,
} from "../fixtures/aprilcube-config.js";

describe("marker outlier resolver", () => {
  it("selects a marker with a large injected corner error", () => {
    const markers = injectBadCornerOnFirstMarker(
      createProjectedAprilCubeMarkers(STANDARD_APRILCUBE_CONFIG),
      120,
    );

    const initialResult = estimateAprilCubePose(
      {
        markers,
        config: STANDARD_APRILCUBE_CONFIG,
        cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
      },
      { enableRansac: false },
    );

    expect(initialResult.success).toBe(true);

    if (!initialResult.success) {
      return;
    }

    const correspondences = buildAprilCubeCorrespondences(markers, STANDARD_APRILCUBE_CONFIG);

    if (!correspondences.success) {
      throw new Error("Expected correspondences to build.");
    }

    const diagnostics = computeAprilCubeMarkerReprojectionDiagnostics(
      correspondences.imagePoints,
      correspondences.objectPoints,
      correspondences.markerIds,
      initialResult.pose,
      CANONICAL_CAMERA_INTRINSICS,
    );

    expect(diagnostics.length).toBeGreaterThanOrEqual(3);

    const meanErrors = diagnostics.map((diagnostic) => diagnostic.meanReprojectionErrorPx);
    const maxMeanError = Math.max(...meanErrors);
    const minMeanError = Math.min(...meanErrors);

    expect(maxMeanError - minMeanError).toBeGreaterThan(5);
    expect(selectOutlierMarkerIds(diagnostics).length).toBeGreaterThan(0);
    expect(initialResult.rejectedMarkerIds.length).toBeGreaterThan(0);
  });
});
