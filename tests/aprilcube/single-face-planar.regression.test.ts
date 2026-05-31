/**
 * Regression: single-face planar pose current behavior and target prior disambiguation.
 */
import { describe, expect, it } from "vitest";
import { estimateAprilCubePose } from "../../src/aprilcube/estimate-aprilcube-pose.js";
import {
  APRILCUBE_GROUND_TRUTH_POSE,
  CANONICAL_CAMERA_INTRINSICS,
  SINGLE_FACE_APRILCUBE_CONFIG,
  createSingleFaceAprilCubeMarkers,
} from "../fixtures/aprilcube-config.js";

describe("single-face planar regression", () => {
  it("returns singleFacePlanar for one marker without prior when one candidate resolves", () => {
    const result = estimateAprilCubePose(
      {
        markers: createSingleFaceAprilCubeMarkers(),
        config: SINGLE_FACE_APRILCUBE_CONFIG,
        cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
      },
      { enableRansac: false },
    );

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.poseMode).toBe("singleFacePlanar");
  });

  it("chooses the prior-closest planar candidate for one marker with previous pose", () => {
    const result = estimateAprilCubePose(
      {
        markers: createSingleFaceAprilCubeMarkers(),
        config: SINGLE_FACE_APRILCUBE_CONFIG,
        cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
      },
      {
        enableRansac: false,
        previousPose: APRILCUBE_GROUND_TRUTH_POSE,
      },
    );

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.poseMode).toBe("singleFacePlanar");
    expect(result.planarCandidateCount).toBeGreaterThanOrEqual(1);

    const translationError = Math.hypot(
      result.pose.translation[0] - APRILCUBE_GROUND_TRUTH_POSE.translation[0],
      result.pose.translation[1] - APRILCUBE_GROUND_TRUTH_POSE.translation[1],
      result.pose.translation[2] - APRILCUBE_GROUND_TRUTH_POSE.translation[2],
    );

    expect(translationError).toBeLessThan(0.01);
  });
});
