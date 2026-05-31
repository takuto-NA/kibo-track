/**
 * Unit tests for AprilCube object point map layout branching.
 */
import { describe, expect, it } from "vitest";
import { buildAprilCubeObjectPointMap } from "../../src/aprilcube/build-object-point-map.js";
import { buildFaceObjectCorners } from "../../src/aprilcube/cube-corners.js";
import {
  EXAMPLE_FACE_ONLY_CONFIG,
  EXAMPLE_TAG_CORNERS_PLUS_Z_METERS,
  EXAMPLE_TAG_GEOMETRY_CONFIG,
  EXAMPLE_MARKER_ID_PLUS_Z,
} from "../fixtures/example-aprilcube-layout.js";
import { APRILCUBE_SIZE_METERS, TWO_FACE_APRILCUBE_CONFIG } from "../fixtures/aprilcube-config.js";

describe("buildAprilCubeObjectPointMap", () => {
  it("uses face corners when cuboidLayout is absent", () => {
    const objectPointMap = buildAprilCubeObjectPointMap(TWO_FACE_APRILCUBE_CONFIG);
    const frontMarkerId = 10;
    const expectedFaceCorners = buildFaceObjectCorners("front", APRILCUBE_SIZE_METERS);

    expect(objectPointMap[frontMarkerId]).toEqual(expectedFaceCorners);
  });

  it("uses tag corners when cuboidLayout is present", () => {
    const objectPointMap = buildAprilCubeObjectPointMap(EXAMPLE_TAG_GEOMETRY_CONFIG);

    expect(objectPointMap[EXAMPLE_MARKER_ID_PLUS_Z]).toEqual(EXAMPLE_TAG_CORNERS_PLUS_Z_METERS);
  });

  it("returns different 3D corners for face-only vs tag-geometry on the same marker", () => {
    const faceOnlyMap = buildAprilCubeObjectPointMap(EXAMPLE_FACE_ONLY_CONFIG);
    const tagGeometryMap = buildAprilCubeObjectPointMap(EXAMPLE_TAG_GEOMETRY_CONFIG);

    expect(faceOnlyMap[EXAMPLE_MARKER_ID_PLUS_Z]).not.toEqual(
      tagGeometryMap[EXAMPLE_MARKER_ID_PLUS_Z],
    );
  });
});
