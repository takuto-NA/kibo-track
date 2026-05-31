/**
 * Regression tests for DLT homography nullspace estimation.
 */
import { describe, expect, it } from "vitest";
import { estimateHomographyFromCorrespondences } from "../../../src/pnp/planar/estimate-homography.js";
import type { HomographyMatrix3x3 } from "../../../src/pnp/planar/types.js";

const HOMOGENEOUS_SCALE = 1;
const HOMOGRAPHY_TOLERANCE = 1e-9;
const NORMALIZED_COORDINATE_TOLERANCE = 1e-9;

const PLANE_SQUARE_SIZE_METERS = 0.2;
const NORMALIZED_IMAGE_MINIMUM_X = -1 / 6;
const NORMALIZED_IMAGE_MAXIMUM_X = 1 / 2;
const NORMALIZED_IMAGE_MINIMUM_Y = -13 / 30;
const NORMALIZED_IMAGE_MAXIMUM_Y = 7 / 30;

const EXPECTED_SCALE_FROM_PLANE_TO_NORMALIZED_IMAGE = 10 / 3;

const PLANE_COORDINATES_2D: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [PLANE_SQUARE_SIZE_METERS, 0],
  [PLANE_SQUARE_SIZE_METERS, PLANE_SQUARE_SIZE_METERS],
  [0, PLANE_SQUARE_SIZE_METERS],
];

const NORMALIZED_IMAGE_POINTS: ReadonlyArray<readonly [number, number]> = [
  [NORMALIZED_IMAGE_MINIMUM_X, NORMALIZED_IMAGE_MINIMUM_Y],
  [NORMALIZED_IMAGE_MAXIMUM_X, NORMALIZED_IMAGE_MINIMUM_Y],
  [NORMALIZED_IMAGE_MAXIMUM_X, NORMALIZED_IMAGE_MAXIMUM_Y],
  [NORMALIZED_IMAGE_MINIMUM_X, NORMALIZED_IMAGE_MAXIMUM_Y],
];

const EXPECTED_HOMOGRAPHY: HomographyMatrix3x3 = [
  EXPECTED_SCALE_FROM_PLANE_TO_NORMALIZED_IMAGE,
  0,
  NORMALIZED_IMAGE_MINIMUM_X,
  0,
  EXPECTED_SCALE_FROM_PLANE_TO_NORMALIZED_IMAGE,
  NORMALIZED_IMAGE_MINIMUM_Y,
  0,
  0,
  HOMOGENEOUS_SCALE,
];

function applyHomographyToPlaneCoordinate(
  homography: HomographyMatrix3x3,
  planeCoordinate: readonly [number, number],
): readonly [number, number] {
  const [planeCoordinateU, planeCoordinateV] = planeCoordinate;
  const homogeneousX =
    homography[0] * planeCoordinateU +
    homography[1] * planeCoordinateV +
    homography[2];
  const homogeneousY =
    homography[3] * planeCoordinateU +
    homography[4] * planeCoordinateV +
    homography[5];
  const homogeneousScale =
    homography[6] * planeCoordinateU +
    homography[7] * planeCoordinateV +
    homography[8];

  return [
    homogeneousX / homogeneousScale,
    homogeneousY / homogeneousScale,
  ];
}

describe("estimateHomographyFromCorrespondences", () => {
  it("recovers the exact nullspace homography for four square correspondences", () => {
    const homography = estimateHomographyFromCorrespondences(
      PLANE_COORDINATES_2D,
      NORMALIZED_IMAGE_POINTS,
    );

    for (let elementIndex = 0; elementIndex < EXPECTED_HOMOGRAPHY.length; elementIndex += 1) {
      expect(homography[elementIndex]).toBeCloseTo(
        EXPECTED_HOMOGRAPHY[elementIndex],
        Math.abs(Math.log10(HOMOGRAPHY_TOLERANCE)),
      );
    }
  });

  it("projects every plane corner back to the normalized image corner", () => {
    const homography = estimateHomographyFromCorrespondences(
      PLANE_COORDINATES_2D,
      NORMALIZED_IMAGE_POINTS,
    );

    for (
      let correspondenceIndex = 0;
      correspondenceIndex < PLANE_COORDINATES_2D.length;
      correspondenceIndex += 1
    ) {
      const planeCoordinate = PLANE_COORDINATES_2D[correspondenceIndex];
      const expectedNormalizedPoint = NORMALIZED_IMAGE_POINTS[correspondenceIndex];

      if (planeCoordinate === undefined || expectedNormalizedPoint === undefined) {
        throw new RangeError("Homography regression fixture is missing a correspondence.");
      }

      const projectedNormalizedPoint = applyHomographyToPlaneCoordinate(
        homography,
        planeCoordinate,
      );

      expect(projectedNormalizedPoint[0]).toBeCloseTo(
        expectedNormalizedPoint[0],
        Math.abs(Math.log10(NORMALIZED_COORDINATE_TOLERANCE)),
      );
      expect(projectedNormalizedPoint[1]).toBeCloseTo(
        expectedNormalizedPoint[1],
        Math.abs(Math.log10(NORMALIZED_COORDINATE_TOLERANCE)),
      );
    }
  });
});
