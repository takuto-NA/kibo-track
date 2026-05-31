/**
 * Diagnostic tests for OpenCV camera convention projection.
 */
import { describe, expect, it } from "vitest";
import { PROJECTION_TOLERANCE_PX } from "../../src/core/constants.js";
import { projectPoint, projectPoints } from "../../src/core/project-points.js";
import {
  AXIS_TEST_DEPTH_METERS,
  CANONICAL_CAMERA_INTRINSICS,
  CANONICAL_FOCAL_LENGTH_PX,
  CANONICAL_PRINCIPAL_POINT_X_PX,
  CANONICAL_PRINCIPAL_POINT_Y_PX,
  EXPECTED_DOWN_POINT_V_OFFSET_PX,
  EXPECTED_FORWARD_POINT_AT_UNIT_DEPTH,
  EXPECTED_RIGHT_POINT_U_OFFSET_PX,
  IDENTITY_CAMERA_FROM_OBJECT_POSE,
  OBJECT_POINT_ONE_METER_DOWN,
  OBJECT_POINT_ONE_METER_FORWARD,
  OBJECT_POINT_ONE_METER_RIGHT,
} from "../fixtures/canonical-camera-intrinsics.js";

describe("projectPoints", () => {
  it("projects the object origin to the principal point for identity pose", () => {
    const projectedPoint = projectPoint(
      [0, 0, AXIS_TEST_DEPTH_METERS],
      IDENTITY_CAMERA_FROM_OBJECT_POSE,
      CANONICAL_CAMERA_INTRINSICS,
    );

    expect(projectedPoint[0]).toBeCloseTo(
      EXPECTED_FORWARD_POINT_AT_UNIT_DEPTH[0],
      PROJECTION_TOLERANCE_PX,
    );
    expect(projectedPoint[1]).toBeCloseTo(
      EXPECTED_FORWARD_POINT_AT_UNIT_DEPTH[1],
      PROJECTION_TOLERANCE_PX,
    );
  });

  it("increases u when camera-space X is positive", () => {
    const projectedPoint = projectPoint(
      OBJECT_POINT_ONE_METER_RIGHT,
      IDENTITY_CAMERA_FROM_OBJECT_POSE,
      CANONICAL_CAMERA_INTRINSICS,
    );

    expect(projectedPoint[0]).toBeCloseTo(
      CANONICAL_PRINCIPAL_POINT_X_PX + EXPECTED_RIGHT_POINT_U_OFFSET_PX,
      PROJECTION_TOLERANCE_PX,
    );
    expect(projectedPoint[1]).toBeCloseTo(
      CANONICAL_PRINCIPAL_POINT_Y_PX,
      PROJECTION_TOLERANCE_PX,
    );
  });

  it("increases v when camera-space Y is positive", () => {
    const projectedPoint = projectPoint(
      OBJECT_POINT_ONE_METER_DOWN,
      IDENTITY_CAMERA_FROM_OBJECT_POSE,
      CANONICAL_CAMERA_INTRINSICS,
    );

    expect(projectedPoint[0]).toBeCloseTo(
      CANONICAL_PRINCIPAL_POINT_X_PX,
      PROJECTION_TOLERANCE_PX,
    );
    expect(projectedPoint[1]).toBeCloseTo(
      CANONICAL_PRINCIPAL_POINT_Y_PX + EXPECTED_DOWN_POINT_V_OFFSET_PX,
      PROJECTION_TOLERANCE_PX,
    );
  });

  it("projects multiple object points in batch", () => {
    const projectedPoints = projectPoints(
      [
        OBJECT_POINT_ONE_METER_FORWARD,
        OBJECT_POINT_ONE_METER_RIGHT,
        OBJECT_POINT_ONE_METER_DOWN,
      ],
      IDENTITY_CAMERA_FROM_OBJECT_POSE,
      CANONICAL_CAMERA_INTRINSICS,
    );

    expect(projectedPoints).toHaveLength(3);
    expect(projectedPoints[0]?.[0]).toBeCloseTo(
      CANONICAL_PRINCIPAL_POINT_X_PX,
      PROJECTION_TOLERANCE_PX,
    );
  });

  it("rejects non-positive camera-space depth", () => {
    expect(() =>
      projectPoint([0, 0, 0], IDENTITY_CAMERA_FROM_OBJECT_POSE, CANONICAL_CAMERA_INTRINSICS),
    ).toThrow(RangeError);
  });

  it("rejects invalid camera intrinsics", () => {
    expect(() =>
      projectPoint(OBJECT_POINT_ONE_METER_FORWARD, IDENTITY_CAMERA_FROM_OBJECT_POSE, {
        focalLengthX: 0,
        focalLengthY: CANONICAL_FOCAL_LENGTH_PX,
        principalPointX: CANONICAL_PRINCIPAL_POINT_X_PX,
        principalPointY: CANONICAL_PRINCIPAL_POINT_Y_PX,
      }),
    ).toThrow(RangeError);
  });
});
