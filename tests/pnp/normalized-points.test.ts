/**
 * Tests for pixel to normalized camera coordinate conversion.
 */
import { describe, expect, it } from "vitest";
import {
  imagePointToNormalizedCameraCoordinate,
  imagePointsToNormalizedCameraCoordinates,
} from "../../src/pnp/normalized-points.js";
import {
  CANONICAL_CAMERA_INTRINSICS,
  CANONICAL_PRINCIPAL_POINT_X_PX,
  CANONICAL_PRINCIPAL_POINT_Y_PX,
} from "../fixtures/canonical-camera-intrinsics.js";

describe("normalized camera coordinates", () => {
  it("maps the principal point to the origin", () => {
    const normalizedPoint = imagePointToNormalizedCameraCoordinate(
      [CANONICAL_PRINCIPAL_POINT_X_PX, CANONICAL_PRINCIPAL_POINT_Y_PX],
      CANONICAL_CAMERA_INTRINSICS,
    );

    expect(normalizedPoint[0]).toBeCloseTo(0);
    expect(normalizedPoint[1]).toBeCloseTo(0);
  });

  it("increases normalized x when u increases", () => {
    const baseNormalizedPoint = imagePointToNormalizedCameraCoordinate(
      [CANONICAL_PRINCIPAL_POINT_X_PX, CANONICAL_PRINCIPAL_POINT_Y_PX],
      CANONICAL_CAMERA_INTRINSICS,
    );
    const shiftedNormalizedPoint = imagePointToNormalizedCameraCoordinate(
      [CANONICAL_PRINCIPAL_POINT_X_PX + 10, CANONICAL_PRINCIPAL_POINT_Y_PX],
      CANONICAL_CAMERA_INTRINSICS,
    );

    expect(shiftedNormalizedPoint[0]).toBeGreaterThan(baseNormalizedPoint[0]);
    expect(shiftedNormalizedPoint[1]).toBeCloseTo(baseNormalizedPoint[1]);
  });

  it("increases normalized y when v increases", () => {
    const baseNormalizedPoint = imagePointToNormalizedCameraCoordinate(
      [CANONICAL_PRINCIPAL_POINT_X_PX, CANONICAL_PRINCIPAL_POINT_Y_PX],
      CANONICAL_CAMERA_INTRINSICS,
    );
    const shiftedNormalizedPoint = imagePointToNormalizedCameraCoordinate(
      [CANONICAL_PRINCIPAL_POINT_X_PX, CANONICAL_PRINCIPAL_POINT_Y_PX + 10],
      CANONICAL_CAMERA_INTRINSICS,
    );

    expect(shiftedNormalizedPoint[1]).toBeGreaterThan(baseNormalizedPoint[1]);
    expect(shiftedNormalizedPoint[0]).toBeCloseTo(baseNormalizedPoint[0]);
  });

  it("converts arrays of image points", () => {
    const normalizedPoints = imagePointsToNormalizedCameraCoordinates(
      [
        [CANONICAL_PRINCIPAL_POINT_X_PX, CANONICAL_PRINCIPAL_POINT_Y_PX],
        [CANONICAL_PRINCIPAL_POINT_X_PX + 80, CANONICAL_PRINCIPAL_POINT_Y_PX + 40],
      ],
      CANONICAL_CAMERA_INTRINSICS,
    );

    expect(normalizedPoints).toHaveLength(2);
    expect(normalizedPoints[0]?.[0]).toBeCloseTo(0);
    expect(normalizedPoints[0]?.[1]).toBeCloseTo(0);
  });
});
