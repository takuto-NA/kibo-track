/**
 * Diagnostic tests for pixel-space reprojection error metrics.
 */
import { describe, expect, it } from "vitest";
import { REPROJECTION_ERROR_TOLERANCE_PX } from "../../src/core/constants.js";
import { projectPoints } from "../../src/core/project-points.js";
import {
  meanReprojectionErrorPx,
  reprojectionError,
} from "../../src/core/reprojection-error.js";
import {
  CANONICAL_CAMERA_INTRINSICS,
  IDENTITY_CAMERA_FROM_OBJECT_POSE,
  OBJECT_POINT_ONE_METER_FORWARD,
  OBJECT_POINT_ONE_METER_RIGHT,
} from "../fixtures/canonical-camera-intrinsics.js";

const KNOWN_OBSERVATION_ERROR_PX = 2;

describe("reprojectionError", () => {
  it("returns zero error for perfectly matching observations", () => {
    const objectPoints = [OBJECT_POINT_ONE_METER_FORWARD, OBJECT_POINT_ONE_METER_RIGHT];
    const projectedPoints = projectPoints(
      objectPoints,
      IDENTITY_CAMERA_FROM_OBJECT_POSE,
      CANONICAL_CAMERA_INTRINSICS,
    );

    const errorSummary = reprojectionError(projectedPoints, projectedPoints);

    expect(errorSummary.meanErrorPx).toBeCloseTo(0, REPROJECTION_ERROR_TOLERANCE_PX);
    expect(errorSummary.perPointErrorsPx).toEqual([0, 0]);
  });

  it("computes known pixel-space error for offset observations", () => {
    const projectedPoints = projectPoints(
      [OBJECT_POINT_ONE_METER_FORWARD],
      IDENTITY_CAMERA_FROM_OBJECT_POSE,
      CANONICAL_CAMERA_INTRINSICS,
    );
    const projectedPoint = projectedPoints[0];

    if (projectedPoint === undefined) {
      throw new Error("Expected a projected point for the forward object point.");
    }

    const observedPoints = [
      [projectedPoint[0] + KNOWN_OBSERVATION_ERROR_PX, projectedPoint[1]],
    ] as const;

    const errorSummary = reprojectionError(observedPoints, projectedPoints);

    expect(errorSummary.perPointErrorsPx[0]).toBeCloseTo(
      KNOWN_OBSERVATION_ERROR_PX,
      REPROJECTION_ERROR_TOLERANCE_PX,
    );
    expect(meanReprojectionErrorPx(observedPoints, projectedPoints)).toBeCloseTo(
      KNOWN_OBSERVATION_ERROR_PX,
      REPROJECTION_ERROR_TOLERANCE_PX,
    );
  });

  it("rejects mismatched point array lengths", () => {
    expect(() =>
      reprojectionError([[0, 0]], [
        [0, 0],
        [1, 1],
      ]),
    ).toThrow(RangeError);
  });

  it("returns zero mean error for empty point arrays", () => {
    const errorSummary = reprojectionError([], []);
    expect(errorSummary.meanErrorPx).toBe(0);
    expect(errorSummary.perPointErrorsPx).toEqual([]);
  });
});

describe("synthetic known pose round trip", () => {
  it("projects known object points and reports zero reprojection error", () => {
    const objectPoints = [
      [0, 0, 2],
      [0.1, -0.2, 2],
      [-0.3, 0.4, 2],
    ] as const;

    const projectedPoints = projectPoints(
      objectPoints,
      IDENTITY_CAMERA_FROM_OBJECT_POSE,
      CANONICAL_CAMERA_INTRINSICS,
    );

    const errorSummary = reprojectionError(projectedPoints, projectedPoints);
    expect(errorSummary.meanErrorPx).toBeCloseTo(0, REPROJECTION_ERROR_TOLERANCE_PX);
  });
});
