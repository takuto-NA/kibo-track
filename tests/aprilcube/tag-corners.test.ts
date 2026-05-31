/**
 * Unit tests for AprilCube tag corner 3D geometry.
 */
import { describe, expect, it } from "vitest";
import { buildAprilCubeTagCornerObjectPointMap } from "../../src/aprilcube/tag-corners.js";
import {
  EXAMPLE_CUBOID_LAYOUT,
  EXAMPLE_CUBE_SIZE_METERS,
  EXAMPLE_MARKER_ID_PLUS_X,
  EXAMPLE_MARKER_ID_PLUS_Z,
  EXAMPLE_TAG_CORNERS_PLUS_X_METERS,
  EXAMPLE_TAG_CORNERS_PLUS_Z_METERS,
  EXAMPLE_TAG_GEOMETRY_CONFIG,
} from "../fixtures/example-aprilcube-layout.js";

describe("AprilCube tag corner geometry", () => {
  it("matches golden corners for marker 4 (+Z) on the example 1x1x1 cube", () => {
    const objectPointMap = buildAprilCubeTagCornerObjectPointMap(EXAMPLE_TAG_GEOMETRY_CONFIG);
    const markerCorners = objectPointMap[EXAMPLE_MARKER_ID_PLUS_Z];

    expect(markerCorners).toBeDefined();
    expect(markerCorners).toEqual(EXAMPLE_TAG_CORNERS_PLUS_Z_METERS);
  });

  it("matches golden corners for marker 0 (+X) on the example 1x1x1 cube", () => {
    const objectPointMap = buildAprilCubeTagCornerObjectPointMap(EXAMPLE_TAG_GEOMETRY_CONFIG);
    const markerCorners = objectPointMap[EXAMPLE_MARKER_ID_PLUS_X];

    expect(markerCorners).toBeDefined();
    expect(markerCorners).toEqual(EXAMPLE_TAG_CORNERS_PLUS_X_METERS);
  });

  it("assigns six markers for a 1x1x1 cuboid layout", () => {
    const objectPointMap = buildAprilCubeTagCornerObjectPointMap({
      cubeSize: EXAMPLE_CUBE_SIZE_METERS,
      faces: {},
      cuboidLayout: EXAMPLE_CUBOID_LAYOUT,
    });

    expect(Object.keys(objectPointMap)).toHaveLength(6);
    expect(objectPointMap[0]?.length).toBe(4);
  });
});
