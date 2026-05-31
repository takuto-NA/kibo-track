/**
 * Tests for EPnP substep modules before full pose integration.
 */
import { describe, expect, it } from "vitest";
import {
  computeBarycentricCoordinates,
  reconstructObjectPointFromBarycentricCoordinates,
} from "../../src/pnp/epnp/barycentric-coordinates.js";
import { chooseControlPoints } from "../../src/pnp/epnp/control-points.js";
import { computeEpnpSubstepsForTests } from "../fixtures/epnp-substep-diagnostics.js";
import { transformObjectPointToCamera } from "../../src/core/pose-matrix.js";
import { hasPositiveCameraSpaceDepth } from "../../src/pnp/epnp/pose-recovery.js";
import { MINIMUM_CAMERA_SPACE_DEPTH } from "../../src/pnp/constants.js";
import { solvePnPInitial } from "../../src/pnp/solve-pnp-initial.js";
import {
  CANONICAL_CAMERA_INTRINSICS,
  NON_COPLANAR_OBJECT_POINTS,
  projectEstimatePoseGroundTruthImagePoints,
} from "../fixtures/estimate-pose-correspondences.js";

describe("EPnP substeps", () => {
  it("selects four finite control points from non-coplanar object points", () => {
    const controlPoints = chooseControlPoints(NON_COPLANAR_OBJECT_POINTS);

    expect(controlPoints).toHaveLength(4);
    for (const controlPoint of controlPoints) {
      expect(Number.isFinite(controlPoint[0])).toBe(true);
      expect(Number.isFinite(controlPoint[1])).toBe(true);
      expect(Number.isFinite(controlPoint[2])).toBe(true);
    }
  });

  it("computes barycentric coordinates that sum to one and reconstruct points", () => {
    const controlPoints = chooseControlPoints(NON_COPLANAR_OBJECT_POINTS);
    const barycentricCoordinates = computeBarycentricCoordinates(
      NON_COPLANAR_OBJECT_POINTS,
      controlPoints,
    );

    expect(barycentricCoordinates).toHaveLength(NON_COPLANAR_OBJECT_POINTS.length);

    for (let pointIndex = 0; pointIndex < barycentricCoordinates.length; pointIndex += 1) {
      const barycentricCoordinate = barycentricCoordinates[pointIndex];
      const originalObjectPoint = NON_COPLANAR_OBJECT_POINTS[pointIndex];

      if (barycentricCoordinate === undefined || originalObjectPoint === undefined) {
        throw new Error("Fixture point is missing.");
      }

      const weightSum =
        barycentricCoordinate[0] +
        barycentricCoordinate[1] +
        barycentricCoordinate[2] +
        barycentricCoordinate[3];

      expect(weightSum).toBeCloseTo(1);

      const reconstructedPoint = reconstructObjectPointFromBarycentricCoordinates(
        barycentricCoordinate,
        controlPoints,
      );

      expect(reconstructedPoint[0]).toBeCloseTo(originalObjectPoint[0]);
      expect(reconstructedPoint[1]).toBeCloseTo(originalObjectPoint[1]);
      expect(reconstructedPoint[2]).toBeCloseTo(originalObjectPoint[2]);
    }
  });

  it("builds a finite 2N x 12 measurement matrix and 144-element null-space basis", () => {
    const substeps = computeEpnpSubstepsForTests({
      objectPoints: NON_COPLANAR_OBJECT_POINTS,
      imagePoints: projectEstimatePoseGroundTruthImagePoints(),
      cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
    });

    expect(substeps.measurementMatrixRows).toBe(2 * NON_COPLANAR_OBJECT_POINTS.length);
    expect(substeps.measurementMatrixColumns).toBe(12);
    expect(substeps.nullSpaceBasisLength).toBe(144);
  });

  it("recovers an initial pose with positive camera-space depth on clean data", () => {
    const initialPoseResult = solvePnPInitial({
      objectPoints: NON_COPLANAR_OBJECT_POINTS,
      imagePoints: projectEstimatePoseGroundTruthImagePoints(),
      cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
    });

    expect(initialPoseResult.success).toBe(true);

    if (!initialPoseResult.success) {
      return;
    }

    expect(initialPoseResult.meanReprojectionErrorPx).toBeLessThan(1);

    const cameraPoints = NON_COPLANAR_OBJECT_POINTS.map((objectPoint) =>
      transformObjectPointToCamera(objectPoint, initialPoseResult.pose),
    );

    expect(
      hasPositiveCameraSpaceDepth(cameraPoints, MINIMUM_CAMERA_SPACE_DEPTH),
    ).toBe(true);
  });
});
