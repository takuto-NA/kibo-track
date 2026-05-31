/**
 * Type-focused tests for estimatePose public result fields.
 */
import { describe, expect, it } from "vitest";
import { estimatePose } from "../../src/pnp/estimate-pose.js";
import {
  CANONICAL_CAMERA_INTRINSICS,
  NON_COPLANAR_OBJECT_POINTS,
  projectEstimatePoseGroundTruthImagePoints,
} from "../fixtures/estimate-pose-correspondences.js";

describe("estimatePose result model", () => {
  it("returns required success diagnostics on clean data", () => {
    const result = estimatePose(
      {
        imagePoints: projectEstimatePoseGroundTruthImagePoints(),
        objectPoints: NON_COPLANAR_OBJECT_POINTS,
        cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
      },
      { enableRansac: false },
    );

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.pose.rotation).toHaveLength(4);
    expect(result.pose.translation).toHaveLength(3);
    expect(result.inlierIndices.length).toBe(result.numInliers);
    expect(result.inlierIndices.length + result.outlierIndices.length).toBe(
      NON_COPLANAR_OBJECT_POINTS.length,
    );
    expect(result.inlierRatio).toBeCloseTo(result.numInliers / NON_COPLANAR_OBJECT_POINTS.length);
    expect(result.meanReprojectionErrorPx).toBe(result.finalMeanReprojectionErrorPx);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.iterations).toBeGreaterThanOrEqual(0);
  });

  it("returns specific failure reasons for invalid input", () => {
    const result = estimatePose({
      imagePoints: projectEstimatePoseGroundTruthImagePoints().slice(0, 2),
      objectPoints: NON_COPLANAR_OBJECT_POINTS.slice(0, 3),
      cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("invalidInput");
    }
  });
});
