/**
 * Regression: single-face planar pose current behavior and target prior disambiguation.
 */
import { describe, expect, it } from "vitest";
import { estimateAprilCubePose } from "../../src/aprilcube/estimate-aprilcube-pose.js";
import type { DetectedMarkerCorners } from "../../src/aprilcube/types.js";
import {
  APRILCUBE_GROUND_TRUTH_POSE,
  CANONICAL_CAMERA_INTRINSICS,
  SINGLE_FACE_APRILCUBE_CONFIG,
  createSingleFaceAprilCubeMarkers,
} from "../fixtures/aprilcube-config.js";

const BAD_SINGLE_FACE_CORNER_OFFSET_PIXELS = 12;

function offsetFirstCorner(
  markers: ReadonlyArray<DetectedMarkerCorners>,
  offsetPixels: number,
): DetectedMarkerCorners[] {
  const firstMarker = markers[0];

  if (firstMarker === undefined || firstMarker.corners[0] === undefined) {
    throw new RangeError("Single-face marker fixture is missing its first corner.");
  }

  return [
    {
      id: firstMarker.id,
      corners: [
        [
          firstMarker.corners[0][0] + offsetPixels,
          firstMarker.corners[0][1] - offsetPixels,
        ],
        ...firstMarker.corners.slice(1),
      ],
    },
  ];
}

describe("single-face planar regression", () => {
  it("returns singleFacePlanar for a clean one-marker pose without prior", () => {
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
    expect(result.finalMeanReprojectionErrorPx).toBeLessThan(1e-6);
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

  it("rejects a single-face planar pose whose final reprojection error is too high", () => {
    const result = estimateAprilCubePose(
      {
        markers: offsetFirstCorner(
          createSingleFaceAprilCubeMarkers(),
          BAD_SINGLE_FACE_CORNER_OFFSET_PIXELS,
        ),
        config: SINGLE_FACE_APRILCUBE_CONFIG,
        cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
      },
      { enableRansac: false },
    );

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.stage).toBe("poseEstimation");
    expect(result.reason).toBe("reprojectionErrorTooHigh");
  });
});
