/**
 * Diagnostic tests for pixel-space LM residuals and invalid-projection penalties.
 */
import { describe, expect, it } from "vitest";
import {
  INVALID_PROJECTION_RESIDUAL_PENALTY_PX,
  POSE_PARAMETER_COUNT,
} from "../../src/pnp/constants.js";
import { buildRefinementResidualFunction } from "../../src/pnp/refine-pose-residuals.js";
import { CANONICAL_CAMERA_INTRINSICS } from "../fixtures/canonical-camera-intrinsics.js";
import {
  GROUND_TRUTH_REFINEMENT_POSE,
  WELL_SPREAD_OBJECT_POINTS,
  projectGroundTruthImagePoints,
} from "../fixtures/refinement-correspondences.js";

describe("buildRefinementResidualFunction", () => {
  it("returns pixel residuals in du,dv order with length 2 * pointCount", () => {
    const observedImagePoints = projectGroundTruthImagePoints();
    const residualFunction = buildRefinementResidualFunction(
      WELL_SPREAD_OBJECT_POINTS,
      observedImagePoints,
      CANONICAL_CAMERA_INTRINSICS,
    );

    const parameterVector = new Float64Array([
      0, 0, 0,
      GROUND_TRUTH_REFINEMENT_POSE.translation[0],
      GROUND_TRUTH_REFINEMENT_POSE.translation[1],
      GROUND_TRUTH_REFINEMENT_POSE.translation[2],
    ]);

    const residuals = residualFunction(parameterVector);

    expect(residuals.length).toBe(WELL_SPREAD_OBJECT_POINTS.length * 2);
    expect(residuals[0]).toBeCloseTo(0, 6);
    expect(residuals[1]).toBeCloseTo(0, 6);
  });

  it("returns finite penalty residuals for invalid trial poses", () => {
    const observedImagePoints = projectGroundTruthImagePoints();
    const residualFunction = buildRefinementResidualFunction(
      WELL_SPREAD_OBJECT_POINTS,
      observedImagePoints,
      CANONICAL_CAMERA_INTRINSICS,
    );

    const invalidTrialParameters = new Float64Array(POSE_PARAMETER_COUNT);
    invalidTrialParameters[5] = -5;

    const firstPenaltyResiduals = residualFunction(invalidTrialParameters);
    const secondPenaltyResiduals = residualFunction(invalidTrialParameters);

    expect(firstPenaltyResiduals.every((value) => value === INVALID_PROJECTION_RESIDUAL_PENALTY_PX)).toBe(
      true,
    );
    expect(secondPenaltyResiduals).not.toBe(firstPenaltyResiduals);
  });
});
