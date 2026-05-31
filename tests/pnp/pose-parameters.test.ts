/**
 * Diagnostic tests for pose parameter packing used by LM refinement.
 */
import { describe, expect, it } from "vitest";
import {
  ANGLE_TOLERANCE_RADIANS,
  QUATERNION_TOLERANCE,
} from "../../src/core/constants.js";
import {
  parameterVectorToPose,
  poseToParameterVector,
  poseToRodriguesTranslationParameters,
  rodriguesTranslationParametersToPose,
} from "../../src/pnp/pose-parameters.js";
import { POSE_PARAMETER_COUNT } from "../../src/pnp/constants.js";
import { GROUND_TRUTH_REFINEMENT_POSE } from "../fixtures/refinement-correspondences.js";
import { IDENTITY_CAMERA_FROM_OBJECT_POSE } from "../fixtures/canonical-camera-intrinsics.js";

describe("pose parameter packing", () => {
  it("round-trips identity pose through rvec and translation parameters", () => {
    const packedParameters = poseToRodriguesTranslationParameters(
      IDENTITY_CAMERA_FROM_OBJECT_POSE,
    );
    const recoveredPose = rodriguesTranslationParametersToPose(packedParameters);

    expect(recoveredPose.translation).toEqual([0, 0, 0]);
    expect(recoveredPose.rotation[3]).toBeCloseTo(1, QUATERNION_TOLERANCE);
  });

  it("round-trips a non-zero translation pose", () => {
    const packedParameters = poseToRodriguesTranslationParameters(
      GROUND_TRUTH_REFINEMENT_POSE,
    );
    const recoveredPose = rodriguesTranslationParametersToPose(packedParameters);

    expect(recoveredPose.translation[0]).toBeCloseTo(
      GROUND_TRUTH_REFINEMENT_POSE.translation[0],
      ANGLE_TOLERANCE_RADIANS,
    );
    expect(recoveredPose.translation[2]).toBeCloseTo(
      GROUND_TRUTH_REFINEMENT_POSE.translation[2],
      ANGLE_TOLERANCE_RADIANS,
    );
  });

  it("packs and unpacks a six-element parameter vector", () => {
    const parameterVector = poseToParameterVector(GROUND_TRUTH_REFINEMENT_POSE);

    expect(parameterVector.length).toBe(POSE_PARAMETER_COUNT);

    const recoveredPose = parameterVectorToPose(parameterVector);
    expect(recoveredPose.translation).toEqual(GROUND_TRUTH_REFINEMENT_POSE.translation);
  });
});
