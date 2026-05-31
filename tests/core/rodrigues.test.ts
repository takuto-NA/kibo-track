/**
 * Diagnostic tests for Rodrigues vector conversion edge cases.
 */
import { describe, expect, it } from "vitest";
import {
  ANGLE_TOLERANCE_RADIANS,
  ROTATION_MATRIX_TOLERANCE,
} from "../../src/core/constants.js";
import {
  quaternionToRotationVector,
  rodriguesToRotationMatrix,
  rotationMatrixToRodrigues,
  rotationVectorToQuaternion,
} from "../../src/core/rodrigues.js";
import { NINETY_DEGREE_Y_AXIS_ROTATION_VECTOR } from "../fixtures/canonical-poses.js";

const SMALL_ROTATION_ANGLE_RADIANS = 1e-4;
const SMALL_ROTATION_VECTOR = [
  SMALL_ROTATION_ANGLE_RADIANS,
  0,
  0,
] as const;

const NEAR_PI_ROTATION_ANGLE_RADIANS = Math.PI - 1e-4;
const NEAR_PI_ROTATION_VECTOR = [
  NEAR_PI_ROTATION_ANGLE_RADIANS,
  0,
  0,
] as const;

describe("rodrigues conversions", () => {
  it("maps zero rotation vector to identity matrix", () => {
    const rotationMatrix = rodriguesToRotationMatrix([0, 0, 0]);

    expect(rotationMatrix[0]).toBeCloseTo(1, ROTATION_MATRIX_TOLERANCE);
    expect(rotationMatrix[4]).toBeCloseTo(1, ROTATION_MATRIX_TOLERANCE);
    expect(rotationMatrix[8]).toBeCloseTo(1, ROTATION_MATRIX_TOLERANCE);
  });

  it("handles small rotation vectors stably", () => {
    const rotationMatrix = rodriguesToRotationMatrix(SMALL_ROTATION_VECTOR);
    const recoveredRotationVector = rotationMatrixToRodrigues(rotationMatrix);

    expect(recoveredRotationVector[0]).toBeCloseTo(
      SMALL_ROTATION_VECTOR[0],
      ANGLE_TOLERANCE_RADIANS,
    );
  });

  it("handles ninety-degree axis-aligned rotations", () => {
    const rotationMatrix = rodriguesToRotationMatrix(
      NINETY_DEGREE_Y_AXIS_ROTATION_VECTOR,
    );
    const recoveredRotationVector = rotationMatrixToRodrigues(rotationMatrix);

    expect(recoveredRotationVector[1]).toBeCloseTo(
      NINETY_DEGREE_Y_AXIS_ROTATION_VECTOR[1],
      ANGLE_TOLERANCE_RADIANS,
    );
  });

  it("handles near-pi rotation vectors", () => {
    const rotationMatrix = rodriguesToRotationMatrix(NEAR_PI_ROTATION_VECTOR);
    const recoveredRotationVector = rotationMatrixToRodrigues(rotationMatrix);

    expect(recoveredRotationVector[0]).toBeCloseTo(
      NEAR_PI_ROTATION_VECTOR[0],
      1e-3,
    );
  });

  it("round-trips rotation vector and quaternion conversions", () => {
    const quaternion = rotationVectorToQuaternion(
      NINETY_DEGREE_Y_AXIS_ROTATION_VECTOR,
    );
    const recoveredRotationVector = quaternionToRotationVector(quaternion);

    expect(recoveredRotationVector[1]).toBeCloseTo(
      NINETY_DEGREE_Y_AXIS_ROTATION_VECTOR[1],
      ANGLE_TOLERANCE_RADIANS,
    );
  });
});
