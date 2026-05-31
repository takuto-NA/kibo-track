/**
 * Integration tests for refinePoseLM behavior and diagnostics.
 */
import { describe, expect, it, vi } from "vitest";
import {
  ANGLE_TOLERANCE_RADIANS,
  REPROJECTION_ERROR_TOLERANCE_PX,
} from "../../src/core/constants.js";
import { quaternionToRotationVector } from "../../src/core/rodrigues.js";
import { MINIMUM_REFINEMENT_CORRESPONDENCE_COUNT } from "../../src/pnp/constants.js";
import { computeImprovementRatio } from "../../src/pnp/improvement-ratio.js";
import { refinePoseLM } from "../../src/pnp/refine-pose-lm.js";
import * as poseParametersModule from "../../src/pnp/pose-parameters.js";
import type { RefinePoseLMSuccess } from "../../src/pnp/types.js";
import { CANONICAL_CAMERA_INTRINSICS } from "../fixtures/canonical-camera-intrinsics.js";
import {
  GROUND_TRUTH_REFINEMENT_POSE,
  SYNTHETIC_OBSERVATION_NOISE_PX,
  WELL_SPREAD_OBJECT_POINTS,
  addDeterministicObservationNoise,
  createPoorInitialPose,
  createRotationPerturbedInitialPose,
  createTranslationPerturbedInitialPose,
  projectGroundTruthImagePoints,
} from "../fixtures/refinement-correspondences.js";

function assertRefinementSuccess(
  result: ReturnType<typeof refinePoseLM>,
): RefinePoseLMSuccess {
  if (!result.success) {
    throw new Error(`Expected refinement success but received ${result.reason}.`);
  }

  return result;
}

describe("refinePoseLM validation", () => {
  it("rejects mismatched point counts before optimization", () => {
    const result = refinePoseLM({
      imagePoints: projectGroundTruthImagePoints().slice(0, 3),
      objectPoints: WELL_SPREAD_OBJECT_POINTS,
      cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
      initialPose: createTranslationPerturbedInitialPose(),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("invalidInput");
    }
  });

  it("rejects fewer than the minimum correspondence count", () => {
    const result = refinePoseLM({
      imagePoints: projectGroundTruthImagePoints().slice(0, 3),
      objectPoints: WELL_SPREAD_OBJECT_POINTS.slice(0, 3),
      cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
      initialPose: createTranslationPerturbedInitialPose(),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("notEnoughPoints");
      expect(WELL_SPREAD_OBJECT_POINTS.slice(0, 3).length).toBeLessThan(
        MINIMUM_REFINEMENT_CORRESPONDENCE_COUNT,
      );
    }
  });

  it("rejects an initial pose that cannot project all points", () => {
    const result = refinePoseLM({
      imagePoints: projectGroundTruthImagePoints(),
      objectPoints: WELL_SPREAD_OBJECT_POINTS,
      cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
      initialPose: {
        rotation: [0, 0, 0, 1],
        translation: [0, 0, -1],
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("invalidInput");
    }
  });

  it("returns degenerateConfiguration when the optimized pose cannot project all points", () => {
    vi.spyOn(poseParametersModule, "parameterVectorToPose").mockReturnValue({
      rotation: [0, 0, 0, 1],
      translation: [0, 0, -0.5],
    });

    const result = refinePoseLM({
      imagePoints: projectGroundTruthImagePoints(),
      objectPoints: WELL_SPREAD_OBJECT_POINTS,
      cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
      initialPose: createTranslationPerturbedInitialPose(),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("degenerateConfiguration");
    }

    vi.restoreAllMocks();
  });
});

describe("refinePoseLM noiseless recovery", () => {
  it("reduces reprojection error from a perturbed initial translation", () => {
    const result = assertRefinementSuccess(
      refinePoseLM({
        imagePoints: projectGroundTruthImagePoints(),
        objectPoints: WELL_SPREAD_OBJECT_POINTS,
        cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
        initialPose: createTranslationPerturbedInitialPose(),
      }),
    );

    expect(result.finalMeanReprojectionErrorPx).toBeLessThan(
      result.initialMeanReprojectionErrorPx,
    );
    expect(result.finalMeanReprojectionErrorPx).toBeCloseTo(
      0,
      REPROJECTION_ERROR_TOLERANCE_PX,
    );
    expect(result.improvementRatio).toBeGreaterThan(0);
    expect(result.pose.translation[0]).toBeCloseTo(
      GROUND_TRUTH_REFINEMENT_POSE.translation[0],
      ANGLE_TOLERANCE_RADIANS,
    );
  });

  it("recovers a small rotation perturbation", () => {
    const result = assertRefinementSuccess(
      refinePoseLM({
        imagePoints: projectGroundTruthImagePoints(),
        objectPoints: WELL_SPREAD_OBJECT_POINTS,
        cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
        initialPose: createRotationPerturbedInitialPose(),
      }),
    );

    const recoveredRotationVector = quaternionToRotationVector(result.pose.rotation);

    expect(result.finalMeanReprojectionErrorPx).toBeLessThan(
      result.initialMeanReprojectionErrorPx,
    );
    expect(recoveredRotationVector[0]).toBeCloseTo(0, 1e-2);
    expect(result.iterations).toBeGreaterThan(0);
  });
});

describe("refinePoseLM observable diagnostics", () => {
  it("exposes enough metrics to inspect refinement quality", () => {
    const result = assertRefinementSuccess(
      refinePoseLM({
        imagePoints: projectGroundTruthImagePoints(),
        objectPoints: WELL_SPREAD_OBJECT_POINTS,
        cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
        initialPose: createTranslationPerturbedInitialPose(),
      }),
    );

    expect(result.improvementRatio).toBe(
      computeImprovementRatio(
        result.initialMeanReprojectionErrorPx,
        result.finalMeanReprojectionErrorPx,
      ),
    );
    expect(typeof result.converged).toBe("boolean");
    expect(typeof result.finalResidualNorm).toBe("number");
    expect(result.initialReprojectionError.meanErrorPx).toBe(
      result.initialMeanReprojectionErrorPx,
    );
    expect(result.finalReprojectionError.meanErrorPx).toBe(
      result.finalMeanReprojectionErrorPx,
    );
  });

  it("recovers noisy synthetic observations close to the noise scale", () => {
    const noisyImagePoints = addDeterministicObservationNoise(
      projectGroundTruthImagePoints(),
    );

    const result = assertRefinementSuccess(
      refinePoseLM({
        imagePoints: noisyImagePoints,
        objectPoints: WELL_SPREAD_OBJECT_POINTS,
        cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
        initialPose: createTranslationPerturbedInitialPose(),
      }),
    );

    expect(result.finalMeanReprojectionErrorPx).toBeLessThan(
      result.initialMeanReprojectionErrorPx,
    );
    expect(result.finalMeanReprojectionErrorPx).toBeLessThan(
      SYNTHETIC_OBSERVATION_NOISE_PX * 2,
    );
  });

  it("keeps poor initial poses inspectable instead of hiding remaining error", () => {
    const result = assertRefinementSuccess(
      refinePoseLM(
        {
          imagePoints: projectGroundTruthImagePoints(),
          objectPoints: WELL_SPREAD_OBJECT_POINTS,
          cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
          initialPose: createPoorInitialPose(),
        },
        { maxIterations: 5 },
      ),
    );

    expect(result.initialMeanReprojectionErrorPx).toBeGreaterThan(1);
    expect(result.finalMeanReprojectionErrorPx).toBeLessThan(
      result.initialMeanReprojectionErrorPx,
    );
    expect(result.improvementRatio).toBeGreaterThan(0);
    expect(typeof result.converged).toBe("boolean");
    expect(result.iterations).toBeLessThanOrEqual(5);
  });

  it("returns plain object diagnostics without exposing optimizer types", () => {
    const result = assertRefinementSuccess(
      refinePoseLM({
        imagePoints: projectGroundTruthImagePoints(),
        objectPoints: WELL_SPREAD_OBJECT_POINTS,
        cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
        initialPose: createTranslationPerturbedInitialPose(),
      }),
    );

    expect(Array.isArray(result.pose.rotation)).toBe(true);
    expect(result.pose.rotation).not.toBeInstanceOf(Float64Array);
    expect(result.initialReprojectionError.perPointErrorsPx).not.toBeInstanceOf(Float64Array);
  });
});
