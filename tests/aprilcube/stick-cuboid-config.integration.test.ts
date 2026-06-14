/**
 * Integration tests for stick 1x1x6 official cuboid config through public API.
 */
import { describe, expect, it } from "vitest";
import { projectPoints } from "../../src/core/project-points.js";
import type { Pose } from "../../src/core/types.js";
import { buildAprilCubeCorrespondences } from "../../src/aprilcube/build-correspondences.js";
import { buildAprilCubeObjectPointMap } from "../../src/aprilcube/build-object-point-map.js";
import { estimateAprilCubePose } from "../../src/aprilcube/estimate-aprilcube-pose.js";
import type { DetectedMarkerCorners } from "../../src/aprilcube/types.js";
import {
  STICK_1X1X6_APRILCUBE_CONFIG,
  STICK_MARKER_ID_PLUS_X_END,
  STICK_MARKER_ID_PLUS_Z_END,
} from "../fixtures/stick-1x1x6-aprilcube-config.js";
import { CANONICAL_CAMERA_INTRINSICS } from "../fixtures/aprilcube-config.js";

const STICK_GROUND_TRUTH_POSE: Pose = {
  rotation: [0, 0, 0, 1],
  translation: [0, 0, 0.5],
};

function createStickMultiFaceSyntheticMarkers(): DetectedMarkerCorners[] {
  const objectPointMap = buildAprilCubeObjectPointMap(STICK_1X1X6_APRILCUBE_CONFIG);
  const markerIds = [STICK_MARKER_ID_PLUS_X_END, STICK_MARKER_ID_PLUS_Z_END];

  return markerIds.map((markerId) => {
    const markerObjectPoints = objectPointMap[markerId];

    if (markerObjectPoints === undefined) {
      throw new RangeError(`Missing object points for stick marker ${markerId}.`);
    }

    return {
      id: markerId,
      corners: projectPoints(markerObjectPoints, STICK_GROUND_TRUTH_POSE, CANONICAL_CAMERA_INTRINSICS),
    };
  });
}

describe("stick cuboid config integration", () => {
  it("builds correspondences for multi-face stick markers", () => {
    const markers = createStickMultiFaceSyntheticMarkers();
    const correspondencesResult = buildAprilCubeCorrespondences(
      markers,
      STICK_1X1X6_APRILCUBE_CONFIG,
    );

    expect(correspondencesResult.success).toBe(true);

    if (!correspondencesResult.success) {
      return;
    }

    expect(correspondencesResult.imagePoints.length).toBeGreaterThanOrEqual(8);
  });

  it("estimates multi-face pose from stick config", () => {
    const markers = createStickMultiFaceSyntheticMarkers();
    const poseResult = estimateAprilCubePose(
      {
        markers,
        config: STICK_1X1X6_APRILCUBE_CONFIG,
        cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
      },
      { enableRansac: false },
    );

    expect(poseResult.success).toBe(true);

    if (!poseResult.success) {
      return;
    }

    expect(poseResult.poseMode).toBe("multiFace");
    expect(poseResult.correspondenceCount).toBeGreaterThanOrEqual(8);
    expect(poseResult.finalMeanReprojectionErrorPx).toBeLessThan(1);
  });
});
