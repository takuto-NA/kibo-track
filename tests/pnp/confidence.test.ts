/**
 * Tests for heuristic measurement confidence scoring.
 */
import { describe, expect, it } from "vitest";
import { computeMeasurementConfidence } from "../../src/pnp/confidence.js";
import { DEFAULT_RANSAC_REPROJECTION_ERROR_THRESHOLD_PX } from "../../src/pnp/constants.js";

describe("measurement confidence", () => {
  it("returns high confidence for clean full inlier coverage", () => {
    const confidence = computeMeasurementConfidence({
      numInliers: 10,
      totalPointCount: 10,
      meanReprojectionErrorPx: 0.01,
      reprojectionErrorThresholdPx: DEFAULT_RANSAC_REPROJECTION_ERROR_THRESHOLD_PX,
    });

    expect(confidence).toBeGreaterThan(0.9);
    expect(confidence).toBeLessThanOrEqual(1);
  });

  it("returns lower confidence for noisy observations", () => {
    const cleanConfidence = computeMeasurementConfidence({
      numInliers: 10,
      totalPointCount: 10,
      meanReprojectionErrorPx: 0.05,
      reprojectionErrorThresholdPx: DEFAULT_RANSAC_REPROJECTION_ERROR_THRESHOLD_PX,
    });
    const noisyConfidence = computeMeasurementConfidence({
      numInliers: 10,
      totalPointCount: 10,
      meanReprojectionErrorPx: 3,
      reprojectionErrorThresholdPx: DEFAULT_RANSAC_REPROJECTION_ERROR_THRESHOLD_PX,
    });

    expect(noisyConfidence).toBeLessThan(cleanConfidence);
  });

  it("returns zero confidence when inlier count is below minimum", () => {
    const confidence = computeMeasurementConfidence({
      numInliers: 2,
      totalPointCount: 10,
      meanReprojectionErrorPx: 0,
      reprojectionErrorThresholdPx: DEFAULT_RANSAC_REPROJECTION_ERROR_THRESHOLD_PX,
    });

    expect(confidence).toBe(0);
  });
});
