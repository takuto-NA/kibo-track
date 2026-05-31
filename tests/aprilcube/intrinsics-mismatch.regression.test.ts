/**
 * Regression: wrong intrinsics yield low tag fit but bad cube wireframe projection.
 */
import { describe, expect, it } from "vitest";
import { projectPoints } from "../../src/core/project-points.js";
import type { CameraIntrinsics, ImagePoint2D } from "../../src/core/types.js";
import { estimateAprilCubePose } from "../../src/aprilcube/estimate-aprilcube-pose.js";
import { buildCubeCornerVertices } from "../../examples/kibo-tag-aprilcube/src/overlay.js";
import { APRILCUBE_GROUND_TRUTH_POSE } from "../fixtures/aprilcube-config.js";
import {
  EXAMPLE_CUBE_SIZE_METERS,
  EXAMPLE_MARKER_ID_PLUS_X,
  EXAMPLE_MARKER_ID_PLUS_Z,
  EXAMPLE_TAG_CORNERS_PLUS_X_METERS,
  EXAMPLE_TAG_CORNERS_PLUS_Z_METERS,
  EXAMPLE_TAG_GEOMETRY_CONFIG,
} from "../fixtures/example-aprilcube-layout.js";
import {
  INTRINSICS_MATCH_MAX_WIREFRAME_ERROR_PX,
  INTRINSICS_MISMATCH_MIN_WIREFRAME_ERROR_PX,
  PLACEHOLDER_INTRINSICS_1280X720,
  TRUE_WEBCAM_INTRINSICS_1280X720,
} from "../fixtures/intrinsics-mismatch.js";

function meanCornerDistancePx(
  projectedCorners: ReadonlyArray<ImagePoint2D>,
  referenceCorners: ReadonlyArray<ImagePoint2D>,
): number {
  if (projectedCorners.length !== referenceCorners.length) {
    throw new RangeError("Corner count mismatch during wireframe error computation.");
  }

  let totalDistance = 0;

  for (let cornerIndex = 0; cornerIndex < projectedCorners.length; cornerIndex += 1) {
    const projectedCorner = projectedCorners[cornerIndex];
    const referenceCorner = referenceCorners[cornerIndex];

    if (projectedCorner === undefined || referenceCorner === undefined) {
      throw new RangeError("Missing corner during wireframe error computation.");
    }

    const deltaX = projectedCorner[0] - referenceCorner[0];
    const deltaY = projectedCorner[1] - referenceCorner[1];
    totalDistance += Math.hypot(deltaX, deltaY);
  }

  return totalDistance / projectedCorners.length;
}

function computeWireframeCornerErrorPx(
  estimatedPose: Parameters<typeof projectPoints>[1],
  cubeSizeMeters: number,
  projectionIntrinsics: CameraIntrinsics,
  referenceIntrinsics: CameraIntrinsics,
  groundTruthPose: Parameters<typeof projectPoints>[1],
): number {
  const cubeVertices = buildCubeCornerVertices(cubeSizeMeters);
  const referenceProjection = projectPoints(
    cubeVertices,
    groundTruthPose,
    referenceIntrinsics,
  );
  const estimatedProjection = projectPoints(
    cubeVertices,
    estimatedPose,
    projectionIntrinsics,
  );

  return meanCornerDistancePx(estimatedProjection, referenceProjection);
}

function createExampleTagProjectedMarkersWithIntrinsics(
  cameraIntrinsics: CameraIntrinsics,
  pose = APRILCUBE_GROUND_TRUTH_POSE,
) {
  return [
    {
      id: EXAMPLE_MARKER_ID_PLUS_X,
      corners: projectPoints(
        EXAMPLE_TAG_CORNERS_PLUS_X_METERS,
        pose,
        cameraIntrinsics,
      ),
    },
    {
      id: EXAMPLE_MARKER_ID_PLUS_Z,
      corners: projectPoints(
        EXAMPLE_TAG_CORNERS_PLUS_Z_METERS,
        pose,
        cameraIntrinsics,
      ),
    },
  ];
}

describe("intrinsics mismatch regression", () => {
  const groundTruthPose = APRILCUBE_GROUND_TRUTH_POSE;
  const trueProjectedMarkers = createExampleTagProjectedMarkersWithIntrinsics(
    TRUE_WEBCAM_INTRINSICS_1280X720,
    groundTruthPose,
  );

  it("produces large wireframe error when pose uses placeholder intrinsics on true-camera detections", () => {
    const poseResult = estimateAprilCubePose(
      {
        markers: trueProjectedMarkers,
        config: EXAMPLE_TAG_GEOMETRY_CONFIG,
        cameraIntrinsics: PLACEHOLDER_INTRINSICS_1280X720,
      },
      { enableRansac: false },
    );

    expect(poseResult.success).toBe(true);

    if (!poseResult.success) {
      return;
    }

    // App draws wireframe with placeholder K; markers come from true-camera detections.
    const wireframeError = computeWireframeCornerErrorPx(
      poseResult.pose,
      EXAMPLE_CUBE_SIZE_METERS,
      PLACEHOLDER_INTRINSICS_1280X720,
      PLACEHOLDER_INTRINSICS_1280X720,
      groundTruthPose,
    );

    expect(wireframeError).toBeGreaterThan(INTRINSICS_MISMATCH_MIN_WIREFRAME_ERROR_PX);
  });

  it("produces low wireframe error when pose and projection use true intrinsics", () => {
    const poseResult = estimateAprilCubePose(
      {
        markers: trueProjectedMarkers,
        config: EXAMPLE_TAG_GEOMETRY_CONFIG,
        cameraIntrinsics: TRUE_WEBCAM_INTRINSICS_1280X720,
      },
      { enableRansac: false },
    );

    expect(poseResult.success).toBe(true);

    if (!poseResult.success) {
      return;
    }

    const wireframeError = computeWireframeCornerErrorPx(
      poseResult.pose,
      EXAMPLE_CUBE_SIZE_METERS,
      TRUE_WEBCAM_INTRINSICS_1280X720,
      TRUE_WEBCAM_INTRINSICS_1280X720,
      groundTruthPose,
    );

    expect(wireframeError).toBeLessThan(INTRINSICS_MATCH_MAX_WIREFRAME_ERROR_PX);
  });
});
