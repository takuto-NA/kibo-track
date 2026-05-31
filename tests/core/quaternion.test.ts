/**
 * Diagnostic tests for quaternion normalization and sign rules.
 */
import { describe, expect, it } from "vitest";
import { QUATERNION_TOLERANCE } from "../../src/core/constants.js";
import {
  alignQuaternionSignToPrevious,
  canonicalizeQuaternionSign,
  computeQuaternionGeodesicAngleRadians,
  normalizeQuaternion,
  quaternionToRotationMatrix,
  rotationMatrixToQuaternion,
  slerpQuaternion,
} from "../../src/core/quaternion.js";
import {
  CURRENT_FRAME_OPPOSITE_SIGN_QUATERNION,
  NEGATIVE_W_EQUIVALENT_QUATERNION,
  POSITIVE_W_QUATERNION,
  PREVIOUS_FRAME_QUATERNION,
} from "../fixtures/canonical-poses.js";

describe("quaternion conventions", () => {
  it("normalizes non-unit quaternions to unit length", () => {
    const normalizedQuaternion = normalizeQuaternion([0, 0, 0, 2]);
    const length = Math.hypot(
      normalizedQuaternion[0],
      normalizedQuaternion[1],
      normalizedQuaternion[2],
      normalizedQuaternion[3],
    );

    expect(length).toBeCloseTo(1, QUATERNION_TOLERANCE);
  });

  it("canonicalizes equivalent quaternions to the same w-positive representation", () => {
    const positiveCanonical = canonicalizeQuaternionSign(POSITIVE_W_QUATERNION);
    const negativeCanonical = canonicalizeQuaternionSign(
      NEGATIVE_W_EQUIVALENT_QUATERNION,
    );

    expect(positiveCanonical).toEqual([0, 0, 0, 1]);
    expect(negativeCanonical).toEqual([0, 0, 0, 1]);
  });

  it("aligns temporal quaternion sign to the previous frame", () => {
    const alignedQuaternion = alignQuaternionSignToPrevious(
      PREVIOUS_FRAME_QUATERNION,
      CURRENT_FRAME_OPPOSITE_SIGN_QUATERNION,
    );

    const dotProduct =
      PREVIOUS_FRAME_QUATERNION[0] * alignedQuaternion[0] +
      PREVIOUS_FRAME_QUATERNION[1] * alignedQuaternion[1] +
      PREVIOUS_FRAME_QUATERNION[2] * alignedQuaternion[2] +
      PREVIOUS_FRAME_QUATERNION[3] * alignedQuaternion[3];

    expect(dotProduct).toBeGreaterThan(0);
  });

  it("round-trips quaternion and rotation matrix conversions", () => {
    const rotationMatrix = quaternionToRotationMatrix(PREVIOUS_FRAME_QUATERNION);
    const recoveredQuaternion = rotationMatrixToQuaternion(rotationMatrix);

    expect(recoveredQuaternion[0]).toBeCloseTo(
      canonicalizeQuaternionSign(PREVIOUS_FRAME_QUATERNION)[0],
      QUATERNION_TOLERANCE,
    );
    expect(recoveredQuaternion[3]).toBeGreaterThanOrEqual(0);
  });

  it("returns the start quaternion when slerp factor is zero", () => {
    const interpolatedQuaternion = slerpQuaternion(
      PREVIOUS_FRAME_QUATERNION,
      CURRENT_FRAME_OPPOSITE_SIGN_QUATERNION,
      0,
    );

    expect(interpolatedQuaternion[0]).toBeCloseTo(
      normalizeQuaternion(PREVIOUS_FRAME_QUATERNION)[0],
      QUATERNION_TOLERANCE,
    );
  });

  it("returns zero geodesic angle for equivalent opposite-sign orientations", () => {
    const geodesicAngleRadians = computeQuaternionGeodesicAngleRadians(
      PREVIOUS_FRAME_QUATERNION,
      CURRENT_FRAME_OPPOSITE_SIGN_QUATERNION,
    );

    expect(geodesicAngleRadians).toBeLessThan(QUATERNION_TOLERANCE);
  });

  it("rejects zero-length quaternions", () => {
    expect(() => normalizeQuaternion([0, 0, 0, 0])).toThrow(RangeError);
  });
});
