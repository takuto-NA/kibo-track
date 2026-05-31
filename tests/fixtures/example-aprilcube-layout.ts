/**
 * Example 1x1x1 AprilCube layout fixtures for geometry regression tests.
 * Tag 3D golden values match AprilCube detect.py build_tag_corner_map formulas.
 */
import { projectPoints } from "../../src/core/project-points.js";
import type { ObjectPoint3D, Pose } from "../../src/core/types.js";
import type {
  AprilCubeConfig,
  AprilCubeCuboidLayout,
  DetectedMarkerCorners,
} from "../../src/aprilcube/types.js";
import { CANONICAL_CAMERA_INTRINSICS } from "./canonical-camera-intrinsics.js";
import { APRILCUBE_GROUND_TRUTH_POSE } from "./aprilcube-config.js";

/** Minimum translation error when face-corner 3D is paired with tag-projected 2D. */
export const GEOMETRY_MISMATCH_MIN_METERS = 4e-3;

/** Example cube edge length in meters (32 mm). */
export const EXAMPLE_CUBE_SIZE_METERS = 0.032;

/** Marker on +X face (AprilCube face label "+X" → kibo-track "right"). */
export const EXAMPLE_MARKER_ID_PLUS_X = 0;

/** Marker on +Z face (AprilCube face label "+Z" → kibo-track "front"). */
export const EXAMPLE_MARKER_ID_PLUS_Z = 4;

/** Tag corner 3D for marker 0 (+X), [TL, TR, BR, BL] in meters. */
export const EXAMPLE_TAG_CORNERS_PLUS_X_METERS: readonly ObjectPoint3D[] = [
  [0.016, -0.012, 0.012],
  [0.016, 0.012, 0.012],
  [0.016, 0.012, -0.012],
  [0.016, -0.012, -0.012],
];

/** Tag corner 3D for marker 4 (+Z), [TL, TR, BR, BL] in meters. */
export const EXAMPLE_TAG_CORNERS_PLUS_Z_METERS: readonly ObjectPoint3D[] = [
  [0.012, -0.012, 0.016],
  [-0.012, -0.012, 0.016],
  [-0.012, 0.012, 0.016],
  [0.012, 0.012, 0.016],
];

/** AprilCube cuboid layout matching the browser example JSON. */
export const EXAMPLE_CUBOID_LAYOUT: AprilCubeCuboidLayout = {
  grid: [1, 1, 1],
  tagIds: [0, 1, 2, 3, 4, 5],
  tagSizeMeters: 0.024,
  cellSizeMeters: 0.004,
  marginCells: 1,
  borderCells: 1,
  markerPixels: 6,
  boxDimensionsMeters: [0.032, 0.032, 0.032],
};

/** Face-only config (legacy v0.4 model) for the example cube. */
export const EXAMPLE_FACE_ONLY_CONFIG: AprilCubeConfig = {
  cubeSize: EXAMPLE_CUBE_SIZE_METERS,
  faces: {
    [EXAMPLE_MARKER_ID_PLUS_X]: "right",
    [EXAMPLE_MARKER_ID_PLUS_Z]: "front",
  },
};

/** Tag-geometry config for the example cube. */
export const EXAMPLE_TAG_GEOMETRY_CONFIG: AprilCubeConfig = {
  cubeSize: EXAMPLE_CUBE_SIZE_METERS,
  faces: {
    [EXAMPLE_MARKER_ID_PLUS_X]: "right",
    [EXAMPLE_MARKER_ID_PLUS_Z]: "front",
  },
  cuboidLayout: EXAMPLE_CUBOID_LAYOUT,
};

function projectTagCornersToImage(
  tagCorners: readonly ObjectPoint3D[],
  markerId: number,
  pose: Pose,
): DetectedMarkerCorners {
  const imageCorners = projectPoints(tagCorners, pose, CANONICAL_CAMERA_INTRINSICS);
  return {
    id: markerId,
    corners: imageCorners,
  };
}

/** Synthetic detections: tag 3D projected to 2D (what kibo-tag returns). */
export function createExampleTagProjectedMarkers(
  pose: Pose = APRILCUBE_GROUND_TRUTH_POSE,
): DetectedMarkerCorners[] {
  return [
    projectTagCornersToImage(
      EXAMPLE_TAG_CORNERS_PLUS_X_METERS,
      EXAMPLE_MARKER_ID_PLUS_X,
      pose,
    ),
    projectTagCornersToImage(
      EXAMPLE_TAG_CORNERS_PLUS_Z_METERS,
      EXAMPLE_MARKER_ID_PLUS_Z,
      pose,
    ),
  ];
}
