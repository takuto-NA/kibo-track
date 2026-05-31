/**
 * Normalizes detector marker corner order into adapter canonical order.
 */
import type { ImagePoint2D } from "../core/types.js";
import { MARKER_CORNER_COUNT } from "./constants.js";
import type { AprilCubeCornerOrderName } from "./types.js";

const CANONICAL_SOURCE_TO_CANONICAL = [0, 1, 2, 3] as const;
const CLOCKWISE_ROTATE_90_SOURCE_TO_CANONICAL = [1, 2, 3, 0] as const;
const CLOCKWISE_ROTATE_180_SOURCE_TO_CANONICAL = [2, 3, 0, 1] as const;
const CLOCKWISE_ROTATE_270_SOURCE_TO_CANONICAL = [3, 0, 1, 2] as const;
const REVERSE_SOURCE_TO_CANONICAL = [0, 3, 2, 1] as const;
const REVERSED_CANONICAL_SOURCE_TO_CANONICAL = [3, 2, 1, 0] as const;

function resolveCornerOrderPermutation(
  cornerOrderName: AprilCubeCornerOrderName,
): readonly number[] {
  if (cornerOrderName === "canonical") {
    return CANONICAL_SOURCE_TO_CANONICAL;
  }

  if (cornerOrderName === "clockwiseRotate90") {
    return CLOCKWISE_ROTATE_90_SOURCE_TO_CANONICAL;
  }

  if (cornerOrderName === "clockwiseRotate180") {
    return CLOCKWISE_ROTATE_180_SOURCE_TO_CANONICAL;
  }

  if (cornerOrderName === "clockwiseRotate270") {
    return CLOCKWISE_ROTATE_270_SOURCE_TO_CANONICAL;
  }

  if (cornerOrderName === "reverse") {
    return REVERSE_SOURCE_TO_CANONICAL;
  }

  return REVERSED_CANONICAL_SOURCE_TO_CANONICAL;
}

/** Reorders one marker's corners into canonical adapter order. */
export function normalizeMarkerCornerOrder(
  detectorCorners: ReadonlyArray<ImagePoint2D>,
  cornerOrderName: AprilCubeCornerOrderName,
): ImagePoint2D[] {
  if (detectorCorners.length !== MARKER_CORNER_COUNT) {
    throw new RangeError("Marker corners must contain exactly four points.");
  }

  const permutation = resolveCornerOrderPermutation(cornerOrderName);

  return permutation.map((sourceCornerIndex) => {
    const corner = detectorCorners[sourceCornerIndex];

    if (corner === undefined) {
      throw new RangeError("Corner index is out of range during normalization.");
    }

    return [corner[0], corner[1]] as ImagePoint2D;
  });
}
