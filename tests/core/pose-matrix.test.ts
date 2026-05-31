/**
 * Diagnostic tests for row-major matrix layout and column-vector math.
 */
import { describe, expect, it } from "vitest";
import { ROTATION_MATRIX_TOLERANCE } from "../../src/core/constants.js";
import {
  poseToMatrix4,
  transformObjectPointToCamera,
  transformObjectPointWithMatrix4,
} from "../../src/core/pose-matrix.js";
import {
  EXPECTED_IDENTITY_MATRIX4,
  POSE_WITH_Y_AXIS_ROTATION,
  TRANSLATION_ONE_METER_ALONG_Z,
} from "../fixtures/canonical-poses.js";
import { IDENTITY_CAMERA_FROM_OBJECT_POSE } from "../fixtures/canonical-camera-intrinsics.js";

describe("poseToMatrix4", () => {
  it("returns row-major identity matrix indices for identity pose", () => {
    const matrix = poseToMatrix4(IDENTITY_CAMERA_FROM_OBJECT_POSE);
    expect(matrix).toEqual(EXPECTED_IDENTITY_MATRIX4);
  });

  it("places translation in the fourth column for column-vector math", () => {
    const matrix = poseToMatrix4({
      rotation: [0, 0, 0, 1],
      translation: TRANSLATION_ONE_METER_ALONG_Z,
    });

    expect(matrix[3]).toBeCloseTo(0, ROTATION_MATRIX_TOLERANCE);
    expect(matrix[7]).toBeCloseTo(0, ROTATION_MATRIX_TOLERANCE);
    expect(matrix[11]).toBeCloseTo(1, ROTATION_MATRIX_TOLERANCE);
  });

  it("transforms object points consistently via matrix and pose helpers", () => {
    const objectPoint = [1, 0, 0] as const;
    const matrix = poseToMatrix4(POSE_WITH_Y_AXIS_ROTATION);

    const transformedByMatrix = transformObjectPointWithMatrix4(objectPoint, matrix);
    const transformedByPose = transformObjectPointToCamera(
      objectPoint,
      POSE_WITH_Y_AXIS_ROTATION,
    );

    expect(transformedByMatrix[0]).toBeCloseTo(
      transformedByPose[0],
      ROTATION_MATRIX_TOLERANCE,
    );
    expect(transformedByMatrix[1]).toBeCloseTo(
      transformedByPose[1],
      ROTATION_MATRIX_TOLERANCE,
    );
    expect(transformedByMatrix[2]).toBeCloseTo(
      transformedByPose[2],
      ROTATION_MATRIX_TOLERANCE,
    );
  });
});
