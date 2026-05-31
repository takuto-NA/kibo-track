/**
 * AprilCube configuration and synthetic marker fixtures for adapter tests.
 */
import { projectPoints } from "../../src/core/project-points.js";
import type { ImagePoint2D, ObjectPoint3D, Pose } from "../../src/core/types.js";
import { buildAprilCubeObjectPointMap } from "../../src/aprilcube/build-object-point-map.js";
import { buildFaceObjectCorners } from "../../src/aprilcube/cube-corners.js";
import type {
  AprilCubeConfig,
  DetectedMarkerCorners,
} from "../../src/aprilcube/types.js";
import { CANONICAL_CAMERA_INTRINSICS } from "./canonical-camera-intrinsics.js";
import { GROUND_TRUTH_REFINEMENT_POSE } from "./refinement-correspondences.js";

export const APRILCUBE_SIZE_METERS = 0.2;

export const APRILCUBE_FRONT_MARKER_ID = 10;
export const APRILCUBE_RIGHT_MARKER_ID = 11;
export const APRILCUBE_BACK_MARKER_ID = 11;
export const APRILCUBE_TOP_MARKER_ID = 12;
export const APRILCUBE_UNKNOWN_MARKER_ID = 99;

export const STANDARD_APRILCUBE_CONFIG: AprilCubeConfig = {
  cubeSize: APRILCUBE_SIZE_METERS,
  faces: {
    [APRILCUBE_FRONT_MARKER_ID]: "front",
    [APRILCUBE_RIGHT_MARKER_ID]: "right",
    [APRILCUBE_TOP_MARKER_ID]: "top",
  },
};

export const SINGLE_FACE_APRILCUBE_CONFIG: AprilCubeConfig = {
  cubeSize: APRILCUBE_SIZE_METERS,
  faces: {
    [APRILCUBE_FRONT_MARKER_ID]: "front",
  },
};

export const TWO_FACE_APRILCUBE_CONFIG: AprilCubeConfig = {
  cubeSize: APRILCUBE_SIZE_METERS,
  faces: {
    [APRILCUBE_FRONT_MARKER_ID]: "front",
    [APRILCUBE_BACK_MARKER_ID]: "back",
  },
};

export const APRILCUBE_GROUND_TRUTH_POSE: Pose = GROUND_TRUTH_REFINEMENT_POSE;

export const APRILCUBE_OBSERVATION_NOISE_PX = 0.5;

export const APRILCUBE_RANSAC_RANDOM_SEED = 42;

const DETERMINISTIC_APRILCUBE_NOISE_PATTERN: readonly ImagePoint2D[] = [
  [0.35, -0.25],
  [-0.15, 0.4],
  [0.2, 0.15],
  [-0.3, -0.2],
  [0.25, 0.3],
  [-0.2, -0.15],
  [0.1, -0.35],
  [-0.25, 0.2],
];

function projectMarkerCornersForPose(
  markerId: number,
  config: AprilCubeConfig,
  pose: Pose,
): ImagePoint2D[] {
  const objectPointMap = buildAprilCubeObjectPointMap(config);
  const markerObjectPoints = objectPointMap[markerId];

  if (markerObjectPoints === undefined) {
    throw new RangeError("Marker object points are missing for projection.");
  }

  return projectPoints(markerObjectPoints, pose, CANONICAL_CAMERA_INTRINSICS);
}

/** Creates synthetic detected markers for the configured multi-face cube. */
export function createProjectedAprilCubeMarkers(
  config: AprilCubeConfig = TWO_FACE_APRILCUBE_CONFIG,
  pose: Pose = APRILCUBE_GROUND_TRUTH_POSE,
): DetectedMarkerCorners[] {
  return Object.keys(config.faces).map((markerIdText) => {
    const markerId = Number(markerIdText);
    return {
      id: markerId,
      corners: projectMarkerCornersForPose(markerId, config, pose),
    };
  });
}

/** Creates synthetic detected markers for one cube face only. */
export function createSingleFaceAprilCubeMarkers(
  pose: Pose = APRILCUBE_GROUND_TRUTH_POSE,
): DetectedMarkerCorners[] {
  return [
    {
      id: APRILCUBE_FRONT_MARKER_ID,
      corners: projectMarkerCornersForPose(
        APRILCUBE_FRONT_MARKER_ID,
        SINGLE_FACE_APRILCUBE_CONFIG,
        pose,
      ),
    },
  ];
}

/** Adds deterministic noise to projected marker corners. */
export function addDeterministicNoiseToAprilCubeMarkers(
  markers: ReadonlyArray<DetectedMarkerCorners>,
): DetectedMarkerCorners[] {
  let noisePatternIndex = 0;

  return markers.map((marker) => ({
    id: marker.id,
    corners: marker.corners.map((corner) => {
      const noisePattern = DETERMINISTIC_APRILCUBE_NOISE_PATTERN[noisePatternIndex];
      noisePatternIndex += 1;

      if (noisePattern === undefined) {
        throw new RangeError("Deterministic AprilCube noise pattern is missing.");
      }

      return [
        corner[0] + noisePattern[0] * APRILCUBE_OBSERVATION_NOISE_PX,
        corner[1] + noisePattern[1] * APRILCUBE_OBSERVATION_NOISE_PX,
      ] as ImagePoint2D;
    }),
  }));
}

/** Injects one bad corner on the first marker of a multi-face fixture. */
export function injectBadCornerOnFirstMarker(
  markers: ReadonlyArray<DetectedMarkerCorners>,
  offsetPx: number,
): DetectedMarkerCorners[] {
  const copiedMarkers = markers.map((marker) => ({
    id: marker.id,
    corners: [...marker.corners],
  }));

  const firstMarker = copiedMarkers[0];

  if (firstMarker === undefined || firstMarker.corners[0] === undefined) {
    throw new RangeError("First marker corner is missing for outlier injection.");
  }

  firstMarker.corners[0] = [
    firstMarker.corners[0][0] + offsetPx,
    firstMarker.corners[0][1] - offsetPx,
  ];

  return copiedMarkers;
}

/** Returns canonical front-face object corners for geometry tests. */
export function expectedFrontFaceObjectCorners(
  cubeSize: number = APRILCUBE_SIZE_METERS,
): readonly ObjectPoint3D[] {
  return buildFaceObjectCorners("front", cubeSize);
}

export { CANONICAL_CAMERA_INTRINSICS };
