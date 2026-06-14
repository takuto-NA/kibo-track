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
import {
  STICK_1X1X6_APRILCUBE_CONFIG,
  STICK_MARKER_ID_PLUS_X_END,
  STICK_MARKER_ID_PLUS_Z_END,
  STICK_TAG_CORNERS_PLUS_X_END_METERS,
  STICK_TAG_CORNERS_PLUS_Z_END_METERS,
} from "../fixtures/stick-1x1x6-aprilcube-config.js";

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

  it("assigns twenty-six markers for stick 1x1x6 cuboid layout", () => {
    const objectPointMap = buildAprilCubeTagCornerObjectPointMap(STICK_1X1X6_APRILCUBE_CONFIG);

    expect(Object.keys(objectPointMap)).toHaveLength(26);
  });

  it("matches golden corners for stick marker 5 (+X end)", () => {
    const objectPointMap = buildAprilCubeTagCornerObjectPointMap(STICK_1X1X6_APRILCUBE_CONFIG);
    const markerCorners = objectPointMap[STICK_MARKER_ID_PLUS_X_END];

    expect(markerCorners).toBeDefined();

    for (let cornerIndex = 0; cornerIndex < STICK_TAG_CORNERS_PLUS_X_END_METERS.length; cornerIndex += 1) {
      const actualCorner = markerCorners![cornerIndex];
      const expectedCorner = STICK_TAG_CORNERS_PLUS_X_END_METERS[cornerIndex];

      expect(actualCorner?.[0]).toBeCloseTo(expectedCorner![0]!, 12);
      expect(actualCorner?.[1]).toBeCloseTo(expectedCorner![1]!, 12);
      expect(actualCorner?.[2]).toBeCloseTo(expectedCorner![2]!, 12);
    }
  });

  it("matches golden corners for stick marker 24 (+Z end cap)", () => {
    const objectPointMap = buildAprilCubeTagCornerObjectPointMap(STICK_1X1X6_APRILCUBE_CONFIG);
    const markerCorners = objectPointMap[STICK_MARKER_ID_PLUS_Z_END];

    expect(markerCorners).toBeDefined();

    for (let cornerIndex = 0; cornerIndex < STICK_TAG_CORNERS_PLUS_Z_END_METERS.length; cornerIndex += 1) {
      const actualCorner = markerCorners![cornerIndex];
      const expectedCorner = STICK_TAG_CORNERS_PLUS_Z_END_METERS[cornerIndex];

      expect(actualCorner?.[0]).toBeCloseTo(expectedCorner![0]!, 12);
      expect(actualCorner?.[1]).toBeCloseTo(expectedCorner![1]!, 12);
      expect(actualCorner?.[2]).toBeCloseTo(expectedCorner![2]!, 12);
    }
  });
});
