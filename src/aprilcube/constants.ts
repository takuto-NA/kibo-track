/**
 * Named constants for the AprilCube adapter.
 */

/** Number of corners per marker face. */
export const MARKER_CORNER_COUNT = 4;

/** Minimum correspondences required before calling estimatePose. */
export const MINIMUM_APRILCUBE_CORRESPONDENCE_COUNT = 4;

/** Distance below which two object points are treated as shared cube corners. */
export const SHARED_CUBE_CORNER_DISTANCE_EPSILON = 1e-9;

/** Canonical corner indices for correspondence metadata. */
export const CANONICAL_CORNER_INDEX_TOP_LEFT = 0;
export const CANONICAL_CORNER_INDEX_TOP_RIGHT = 1;
export const CANONICAL_CORNER_INDEX_BOTTOM_RIGHT = 2;
export const CANONICAL_CORNER_INDEX_BOTTOM_LEFT = 3;

/** Default detector corner order when config omits cornerOrder. */
export const DEFAULT_APRILCUBE_CORNER_ORDER = "canonical" as const;
