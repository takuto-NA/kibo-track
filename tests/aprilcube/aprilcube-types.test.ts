/**
 * Type-focused tests for AprilCube adapter public result fields.
 */
import { describe, expect, it } from "vitest";
import { buildAprilCubeCorrespondences } from "../../src/aprilcube/build-correspondences.js";
import { estimateAprilCubePose } from "../../src/aprilcube/estimate-aprilcube-pose.js";
import {
  CANONICAL_CAMERA_INTRINSICS,
  SINGLE_FACE_APRILCUBE_CONFIG,
  TWO_FACE_APRILCUBE_CONFIG,
  createProjectedAprilCubeMarkers,
  createSingleFaceAprilCubeMarkers,
} from "../fixtures/aprilcube-config.js";

describe("AprilCube adapter result model", () => {
  it("returns correspondence metadata on success", () => {
    const result = buildAprilCubeCorrespondences(
      createProjectedAprilCubeMarkers(TWO_FACE_APRILCUBE_CONFIG),
      TWO_FACE_APRILCUBE_CONFIG,
    );

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.markerIds.length).toBe(result.imagePoints.length);
    expect(result.cornerIndices.length).toBe(result.objectPoints.length);
  });

  it("returns adapter metadata on pose success", () => {
    const result = estimateAprilCubePose(
      {
        markers: createProjectedAprilCubeMarkers(TWO_FACE_APRILCUBE_CONFIG),
        config: TWO_FACE_APRILCUBE_CONFIG,
        cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
      },
      { enableRansac: false },
    );

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.detectedMarkerCount).toBe(2);
    expect(result.correspondenceCount).toBe(8);
    expect(result.correspondenceMarkerIds).toHaveLength(8);
    expect(result.correspondenceCornerIndices).toHaveLength(8);
  });

  it("returns poseEstimation degenerateConfiguration for unsupported single-face pose", () => {
    const result = estimateAprilCubePose(
      {
        markers: createSingleFaceAprilCubeMarkers(),
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
    expect(result.reason).toBe("degenerateConfiguration");
  });
});
