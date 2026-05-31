/**
 * Tests for center-origin AprilCube face object corner generation.
 */
import { describe, expect, it } from "vitest";
import {
  buildFaceObjectCorners,
  computeFaceCenter,
} from "../../src/aprilcube/cube-corners.js";
import type { AprilCubeFaceName } from "../../src/aprilcube/types.js";
import { APRILCUBE_SIZE_METERS } from "../fixtures/aprilcube-config.js";

const HALF_CUBE_SIZE = APRILCUBE_SIZE_METERS / 2;

function expectAllCornersOnPlane(
  corners: readonly (readonly [number, number, number])[],
  axisIndex: number,
  planeValue: number,
): void {
  for (const corner of corners) {
    expect(corner[axisIndex]).toBeCloseTo(planeValue);
  }
}

function expectUniqueCorners(
  corners: readonly (readonly [number, number, number])[],
): void {
  const serializedCorners = corners.map((corner) => corner.join(","));
  expect(new Set(serializedCorners).size).toBe(corners.length);
}

function computeCentroid(
  corners: readonly (readonly [number, number, number])[],
): [number, number, number] {
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;

  for (const corner of corners) {
    sumX += corner[0];
    sumY += corner[1];
    sumZ += corner[2];
  }

  const inverseCount = 1 / corners.length;
  return [sumX * inverseCount, sumY * inverseCount, sumZ * inverseCount];
}

describe("AprilCube face object corners", () => {
  it("places front and back faces on the expected z planes", () => {
    expectAllCornersOnPlane(
      buildFaceObjectCorners("front", APRILCUBE_SIZE_METERS),
      2,
      HALF_CUBE_SIZE,
    );
    expectAllCornersOnPlane(
      buildFaceObjectCorners("back", APRILCUBE_SIZE_METERS),
      2,
      -HALF_CUBE_SIZE,
    );
  });

  it("places right and left faces on the expected x planes", () => {
    expectAllCornersOnPlane(
      buildFaceObjectCorners("right", APRILCUBE_SIZE_METERS),
      0,
      HALF_CUBE_SIZE,
    );
    expectAllCornersOnPlane(
      buildFaceObjectCorners("left", APRILCUBE_SIZE_METERS),
      0,
      -HALF_CUBE_SIZE,
    );
  });

  it("places bottom and top faces on the expected y planes", () => {
    expectAllCornersOnPlane(
      buildFaceObjectCorners("bottom", APRILCUBE_SIZE_METERS),
      1,
      HALF_CUBE_SIZE,
    );
    expectAllCornersOnPlane(
      buildFaceObjectCorners("top", APRILCUBE_SIZE_METERS),
      1,
      -HALF_CUBE_SIZE,
    );
  });

  it("uses four unique corners with centroid at the face center", () => {
    const faceNames: AprilCubeFaceName[] = [
      "front",
      "back",
      "left",
      "right",
      "top",
      "bottom",
    ];

    for (const faceName of faceNames) {
      const corners = buildFaceObjectCorners(faceName, APRILCUBE_SIZE_METERS);
      const centroid = computeCentroid(corners);
      const expectedCenter = computeFaceCenter(faceName, APRILCUBE_SIZE_METERS);

      expectUniqueCorners(corners);
      expect(centroid[0]).toBeCloseTo(expectedCenter[0]);
      expect(centroid[1]).toBeCloseTo(expectedCenter[1]);
      expect(centroid[2]).toBeCloseTo(expectedCenter[2]);
    }
  });

  it("uses half-cube coordinates on varying axes for each face", () => {
    const frontCorners = buildFaceObjectCorners("front", APRILCUBE_SIZE_METERS);
    const xValues = frontCorners.map((corner) => corner[0]);
    const yValues = frontCorners.map((corner) => corner[1]);

    expect(new Set(xValues)).toEqual(new Set([-HALF_CUBE_SIZE, HALF_CUBE_SIZE]));
    expect(new Set(yValues)).toEqual(new Set([-HALF_CUBE_SIZE, HALF_CUBE_SIZE]));
  });
});
