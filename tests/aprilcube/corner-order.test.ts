/**
 * Tests for detector corner order normalization.
 */
import { describe, expect, it } from "vitest";
import { normalizeMarkerCornerOrder } from "../../src/aprilcube/corner-order.js";
import type { ImagePoint2D } from "../../src/core/types.js";

const CANONICAL_CORNERS: readonly ImagePoint2D[] = [
  [100, 100],
  [200, 100],
  [200, 200],
  [100, 200],
];

describe("AprilCube corner order normalization", () => {
  it("keeps canonical order unchanged", () => {
    const normalizedCorners = normalizeMarkerCornerOrder(CANONICAL_CORNERS, "canonical");
    expect(normalizedCorners).toEqual([...CANONICAL_CORNERS]);
  });

  it("normalizes clockwise 90 degree rotated detector order", () => {
    const rotatedCorners: ImagePoint2D[] = [
      CANONICAL_CORNERS[3]!,
      CANONICAL_CORNERS[0]!,
      CANONICAL_CORNERS[1]!,
      CANONICAL_CORNERS[2]!,
    ];

    const normalizedCorners = normalizeMarkerCornerOrder(
      rotatedCorners,
      "clockwiseRotate90",
    );

    expect(normalizedCorners).toEqual([...CANONICAL_CORNERS]);
  });

  it("normalizes clockwise 180 degree rotated detector order", () => {
    const rotatedCorners: ImagePoint2D[] = [
      CANONICAL_CORNERS[2]!,
      CANONICAL_CORNERS[3]!,
      CANONICAL_CORNERS[0]!,
      CANONICAL_CORNERS[1]!,
    ];

    const normalizedCorners = normalizeMarkerCornerOrder(
      rotatedCorners,
      "clockwiseRotate180",
    );

    expect(normalizedCorners).toEqual([...CANONICAL_CORNERS]);
  });

  it("normalizes reversed detector order", () => {
    const reversedCorners: ImagePoint2D[] = [
      CANONICAL_CORNERS[0]!,
      CANONICAL_CORNERS[3]!,
      CANONICAL_CORNERS[2]!,
      CANONICAL_CORNERS[1]!,
    ];

    const normalizedCorners = normalizeMarkerCornerOrder(reversedCorners, "reverse");
    expect(normalizedCorners).toEqual([...CANONICAL_CORNERS]);
  });

  it("normalizes detector order that is the full reverse of canonical", () => {
    const reversedCanonicalCorners: ImagePoint2D[] = [
      CANONICAL_CORNERS[3]!,
      CANONICAL_CORNERS[2]!,
      CANONICAL_CORNERS[1]!,
      CANONICAL_CORNERS[0]!,
    ];

    const normalizedCorners = normalizeMarkerCornerOrder(
      reversedCanonicalCorners,
      "reversedCanonical",
    );
    expect(normalizedCorners).toEqual([...CANONICAL_CORNERS]);
  });
});
