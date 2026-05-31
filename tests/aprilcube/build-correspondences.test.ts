/**
 * Tests for AprilCube correspondence assembly.
 */
import { describe, expect, it } from "vitest";
import { buildAprilCubeCorrespondences } from "../../src/aprilcube/build-correspondences.js";
import {
  APRILCUBE_BACK_MARKER_ID,
  APRILCUBE_FRONT_MARKER_ID,
  APRILCUBE_RIGHT_MARKER_ID,
  APRILCUBE_SIZE_METERS,
  APRILCUBE_UNKNOWN_MARKER_ID,
  SINGLE_FACE_APRILCUBE_CONFIG,
  TWO_FACE_APRILCUBE_CONFIG,
  createProjectedAprilCubeMarkers,
  createSingleFaceAprilCubeMarkers,
} from "../fixtures/aprilcube-config.js";
import type { AprilCubeConfig } from "../../src/aprilcube/types.js";

describe("buildAprilCubeCorrespondences", () => {
  it("builds four correspondences for one visible marker", () => {
    const result = buildAprilCubeCorrespondences(
      createSingleFaceAprilCubeMarkers(),
      SINGLE_FACE_APRILCUBE_CONFIG,
    );

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.imagePoints).toHaveLength(4);
    expect(result.objectPoints).toHaveLength(4);
    expect(result.markerIds).toEqual([APRILCUBE_FRONT_MARKER_ID, APRILCUBE_FRONT_MARKER_ID, APRILCUBE_FRONT_MARKER_ID, APRILCUBE_FRONT_MARKER_ID]);
    expect(result.cornerIndices).toEqual([0, 1, 2, 3]);
  });

  it("builds six correspondences for two adjacent faces after shared-corner deduplication", () => {
    const adjacentFaceConfig: AprilCubeConfig = {
      cubeSize: APRILCUBE_SIZE_METERS,
      faces: {
        [APRILCUBE_FRONT_MARKER_ID]: "front",
        [APRILCUBE_RIGHT_MARKER_ID]: "right",
      },
    };

    const result = buildAprilCubeCorrespondences(
      createProjectedAprilCubeMarkers(adjacentFaceConfig),
      adjacentFaceConfig,
    );

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.imagePoints).toHaveLength(6);
    expect(result.markerIds).toHaveLength(6);
  });

  it("builds eight deterministic correspondences for two opposite faces", () => {
    const result = buildAprilCubeCorrespondences(
      createProjectedAprilCubeMarkers(TWO_FACE_APRILCUBE_CONFIG),
      TWO_FACE_APRILCUBE_CONFIG,
    );

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.imagePoints).toHaveLength(8);
    expect(result.markerIds.slice(0, 4)).toEqual([
      APRILCUBE_FRONT_MARKER_ID,
      APRILCUBE_FRONT_MARKER_ID,
      APRILCUBE_FRONT_MARKER_ID,
      APRILCUBE_FRONT_MARKER_ID,
    ]);
    expect(result.markerIds.slice(4)).toEqual([
      APRILCUBE_BACK_MARKER_ID,
      APRILCUBE_BACK_MARKER_ID,
      APRILCUBE_BACK_MARKER_ID,
      APRILCUBE_BACK_MARKER_ID,
    ]);
  });

  it("returns invalidConfig for malformed cube configuration", () => {
    const result = buildAprilCubeCorrespondences(createSingleFaceAprilCubeMarkers(), {
      cubeSize: 0,
      faces: SINGLE_FACE_APRILCUBE_CONFIG.faces,
    });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.reason).toBe("invalidConfig");
  });

  it("normalizes reordered detector corners to the same correspondences as canonical order", () => {
    const canonicalResult = buildAprilCubeCorrespondences(
      createSingleFaceAprilCubeMarkers(),
      SINGLE_FACE_APRILCUBE_CONFIG,
    );
    const rotatedConfig = {
      ...SINGLE_FACE_APRILCUBE_CONFIG,
      cornerOrder: "clockwiseRotate90" as const,
    };
    const rotatedMarkers = createSingleFaceAprilCubeMarkers().map((marker) => ({
      id: marker.id,
      corners: [
        marker.corners[3]!,
        marker.corners[0]!,
        marker.corners[1]!,
        marker.corners[2]!,
      ],
    }));
    const rotatedResult = buildAprilCubeCorrespondences(rotatedMarkers, rotatedConfig);

    expect(canonicalResult.success).toBe(true);
    expect(rotatedResult.success).toBe(true);

    if (!canonicalResult.success || !rotatedResult.success) {
      return;
    }

    expect(rotatedResult.imagePoints).toEqual(canonicalResult.imagePoints);
    expect(rotatedResult.objectPoints).toEqual(canonicalResult.objectPoints);
    expect(rotatedResult.markerIds).toEqual(canonicalResult.markerIds);
    expect(rotatedResult.cornerIndices).toEqual(canonicalResult.cornerIndices);
  });

  it("returns unknownMarkerId for unconfigured detections", () => {
    const markers = createProjectedAprilCubeMarkers(TWO_FACE_APRILCUBE_CONFIG);
    const result = buildAprilCubeCorrespondences(
      [
        ...markers,
        {
          id: APRILCUBE_UNKNOWN_MARKER_ID,
          corners: [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
        },
      ],
      TWO_FACE_APRILCUBE_CONFIG,
    );

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.reason).toBe("unknownMarkerId");
  });

  it("returns duplicateMarkerId when the same marker appears twice", () => {
    const markers = createSingleFaceAprilCubeMarkers();
    const result = buildAprilCubeCorrespondences(
      [...markers, ...markers],
      SINGLE_FACE_APRILCUBE_CONFIG,
    );

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.reason).toBe("duplicateMarkerId");
  });

  it("returns invalidCornerCount when a marker does not have four corners", () => {
    const result = buildAprilCubeCorrespondences(
      [
        {
          id: APRILCUBE_FRONT_MARKER_ID,
          corners: [
            [0, 0],
            [1, 0],
            [1, 1],
          ],
        },
      ],
      SINGLE_FACE_APRILCUBE_CONFIG,
    );

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.reason).toBe("invalidCornerCount");
  });

  it("returns notEnoughCorners for empty marker input", () => {
    const result = buildAprilCubeCorrespondences([], SINGLE_FACE_APRILCUBE_CONFIG);

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.reason).toBe("notEnoughCorners");
  });
});
