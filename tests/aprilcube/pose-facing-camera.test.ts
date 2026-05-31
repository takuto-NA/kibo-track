/**
 * Regression: cuboid face-normal chirality rejects mirrored planar poses without prior.
 */
import { describe, expect, it } from "vitest";
import { estimateAprilCubePose } from "../../src/aprilcube/estimate-aprilcube-pose.js";
import { isPoseFacingCameraForMarkers } from "../../src/aprilcube/pose-facing-camera.js";
import type { Pose } from "../../src/core/types.js";
import {
  CANONICAL_CAMERA_INTRINSICS,
  createSingleFaceAprilCubeMarkers,
} from "../fixtures/aprilcube-config.js";
import { EXAMPLE_CUBE_SIZE_METERS } from "../fixtures/example-aprilcube-layout.js";
import {
  STATIC_PHOTO_BACK_MARKER_5,
  STATIC_PHOTO_GOLDEN_TRANSLATION_TOLERANCE_METERS,
  STATIC_PHOTO_MARKER_5_GOLDEN_DEPTH_METERS,
  STATIC_PHOTO_MARKER_5_ONLY_CONFIG,
  STATIC_PHOTO_MAXIMUM_GOOD_REPROJECTION_ERROR_PX,
  buildStaticPhotoEstimateInput,
} from "../fixtures/static-aprilcube-photo-corners.js";

/** Mirror-like pose: back face normal points away from the camera. */
const MIRRORED_BACK_FACE_POSE: Pose = {
  rotation: [0, 1, 0, 0],
  translation: [0.05, -0.03, -0.2],
};

describe("pose facing camera chirality", () => {
  it("skips the chirality gate when cuboidLayout is undefined", () => {
    const markers = createSingleFaceAprilCubeMarkers();
    const input = {
      markers: [...markers],
      config: {
        cubeSize: EXAMPLE_CUBE_SIZE_METERS,
        faces: { 10: "front" },
      },
      cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
    };

    expect(
      isPoseFacingCameraForMarkers(input, [10], MIRRORED_BACK_FACE_POSE),
    ).toBe(true);
  });

  it("rejects a mirrored pose whose back face normal points away from the camera", () => {
    const input = buildStaticPhotoEstimateInput(
      [STATIC_PHOTO_BACK_MARKER_5],
      STATIC_PHOTO_MARKER_5_ONLY_CONFIG,
    );

    expect(
      isPoseFacingCameraForMarkers(input, [5], MIRRORED_BACK_FACE_POSE),
    ).toBe(false);
  });

  it("returns a camera-facing single-face pose without previousPose", () => {
    const input = buildStaticPhotoEstimateInput(
      [STATIC_PHOTO_BACK_MARKER_5],
      STATIC_PHOTO_MARKER_5_ONLY_CONFIG,
    );
    const result = estimateAprilCubePose(input, { enableRansac: false });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.poseMode).toBe("singleFacePlanar");
    expect(isPoseFacingCameraForMarkers(input, [5], result.pose)).toBe(true);
    expect(result.pose.translation[2]).toBeGreaterThan(0);
    expect(result.finalMeanReprojectionErrorPx).toBeLessThan(
      STATIC_PHOTO_MAXIMUM_GOOD_REPROJECTION_ERROR_PX,
    );
    expect(
      Math.abs(result.pose.translation[2] - STATIC_PHOTO_MARKER_5_GOLDEN_DEPTH_METERS),
    ).toBeLessThan(STATIC_PHOTO_GOLDEN_TRANSLATION_TOLERANCE_METERS);
  });
});
