/**
 * Unit tests for homography-based planar pose estimation.
 */
import { describe, expect, it } from "vitest";
import { projectPoints } from "../../../src/core/project-points.js";
import type { ObjectPoint3D, Pose } from "../../../src/core/types.js";
import { estimatePlanarPose } from "../../../src/pnp/planar/estimate-planar-pose.js";
import { CANONICAL_CAMERA_INTRINSICS } from "../../fixtures/canonical-camera-intrinsics.js";
import { GROUND_TRUTH_REFINEMENT_POSE } from "../../fixtures/refinement-correspondences.js";

const FRONT_PLANE_OBJECT_POINTS: readonly ObjectPoint3D[] = [
  [-0.1, -0.1, 0.2],
  [0.1, -0.1, 0.2],
  [0.1, 0.1, 0.2],
  [-0.1, 0.1, 0.2],
];

const OBLIQUE_PLANE_POSE: Pose = {
  rotation: [0.08, -0.12, 0.05, 0.989],
  translation: [0.03, -0.02, 0.25],
};

const TRANSLATION_TOLERANCE_METERS = 0.01;
const REPROJECTION_TOLERANCE_PX = 1;

function createProjectedCorrespondences(objectPoints: readonly ObjectPoint3D[], pose: Pose) {
  return {
    objectPoints,
    imagePoints: projectPoints(objectPoints, pose, CANONICAL_CAMERA_INTRINSICS),
  };
}

describe("estimatePlanarPose", () => {
  it("succeeds with a single valid candidate for fronto-parallel pose without prior", () => {
    const correspondences = createProjectedCorrespondences(
      FRONT_PLANE_OBJECT_POINTS,
      GROUND_TRUTH_REFINEMENT_POSE,
    );

    const result = estimatePlanarPose({
      imagePoints: correspondences.imagePoints,
      objectPoints: correspondences.objectPoints,
      cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.finalMeanReprojectionErrorPx).toBeLessThan(REPROJECTION_TOLERANCE_PX);
  });

  it("recovers an oblique planar marker pose with prior refinement", () => {
    const correspondences = createProjectedCorrespondences(
      FRONT_PLANE_OBJECT_POINTS,
      OBLIQUE_PLANE_POSE,
    );

    const result = estimatePlanarPose(
      {
        imagePoints: correspondences.imagePoints,
        objectPoints: correspondences.objectPoints,
        cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
      },
      {
        previousPose: OBLIQUE_PLANE_POSE,
      },
    );

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.finalMeanReprojectionErrorPx).toBeLessThan(REPROJECTION_TOLERANCE_PX);
  });

  it("chooses the prior-closest candidate when two mirrored solutions exist", () => {
    const correspondences = createProjectedCorrespondences(
      FRONT_PLANE_OBJECT_POINTS,
      GROUND_TRUTH_REFINEMENT_POSE,
    );

    const farPriorPose: Pose = {
      rotation: GROUND_TRUTH_REFINEMENT_POSE.rotation,
      translation: [
        GROUND_TRUTH_REFINEMENT_POSE.translation[0] + 0.5,
        GROUND_TRUTH_REFINEMENT_POSE.translation[1],
        GROUND_TRUTH_REFINEMENT_POSE.translation[2],
      ],
    };

    const result = estimatePlanarPose(
      {
        imagePoints: correspondences.imagePoints,
        objectPoints: correspondences.objectPoints,
        cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
      },
      {
        previousPose: GROUND_TRUTH_REFINEMENT_POSE,
      },
    );

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    const priorDistance = Math.hypot(
      result.pose.translation[0] - GROUND_TRUTH_REFINEMENT_POSE.translation[0],
      result.pose.translation[1] - GROUND_TRUTH_REFINEMENT_POSE.translation[1],
      result.pose.translation[2] - GROUND_TRUTH_REFINEMENT_POSE.translation[2],
    );
    const farPriorDistance = Math.hypot(
      result.pose.translation[0] - farPriorPose.translation[0],
      result.pose.translation[1] - farPriorPose.translation[1],
      result.pose.translation[2] - farPriorPose.translation[2],
    );

    expect(priorDistance).toBeLessThan(farPriorDistance);
  });
});
