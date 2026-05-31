/**
 * Converts detected AprilCube marker corners into stable 2D-3D correspondences.
 */
import type { ImagePoint2D, ObjectPoint3D } from "../core/types.js";
import { buildAprilCubeObjectPointMapUnchecked } from "./build-object-point-map.js";
import { normalizeMarkerCornerOrder } from "./corner-order.js";
import {
  DEFAULT_APRILCUBE_CORNER_ORDER,
  MARKER_CORNER_COUNT,
  MINIMUM_APRILCUBE_CORRESPONDENCE_COUNT,
  SHARED_CUBE_CORNER_DISTANCE_EPSILON,
} from "./constants.js";
import { isValidAprilCubeConfig } from "./validate-config.js";
import type {
  AprilCubeConfig,
  AprilCubeCorrespondencesResult,
  DetectedMarkerCorners,
} from "./types.js";

function hasDuplicateMarkerId(markers: ReadonlyArray<DetectedMarkerCorners>): boolean {
  const seenMarkerIds = new Set<number>();

  for (const marker of markers) {
    if (seenMarkerIds.has(marker.id)) {
      return true;
    }

    seenMarkerIds.add(marker.id);
  }

  return false;
}

function findUnknownMarkerId(
  markers: ReadonlyArray<DetectedMarkerCorners>,
  configuredMarkerIds: ReadonlySet<number>,
): number | null {
  for (const marker of markers) {
    if (!configuredMarkerIds.has(marker.id)) {
      return marker.id;
    }
  }

  return null;
}

function findInvalidCornerCountMarker(
  markers: ReadonlyArray<DetectedMarkerCorners>,
): DetectedMarkerCorners | null {
  for (const marker of markers) {
    if (marker.corners.length !== MARKER_CORNER_COUNT) {
      return marker;
    }
  }

  return null;
}

function sortMarkersById(
  markers: ReadonlyArray<DetectedMarkerCorners>,
): DetectedMarkerCorners[] {
  return [...markers].sort((leftMarker, rightMarker) => leftMarker.id - rightMarker.id);
}

function isSameObjectPoint(
  firstObjectPoint: ObjectPoint3D,
  secondObjectPoint: ObjectPoint3D,
): boolean {
  const deltaX = firstObjectPoint[0] - secondObjectPoint[0];
  const deltaY = firstObjectPoint[1] - secondObjectPoint[1];
  const deltaZ = firstObjectPoint[2] - secondObjectPoint[2];
  const distance = Math.hypot(deltaX, deltaY, deltaZ);

  return distance <= SHARED_CUBE_CORNER_DISTANCE_EPSILON;
}

function hasObjectPointAlready(
  objectPoints: ReadonlyArray<ObjectPoint3D>,
  candidateObjectPoint: ObjectPoint3D,
): boolean {
  for (const existingObjectPoint of objectPoints) {
    if (isSameObjectPoint(existingObjectPoint, candidateObjectPoint)) {
      return true;
    }
  }

  return false;
}

/** Builds AprilCube correspondences from detected markers and configuration. */
export function buildAprilCubeCorrespondences(
  markers: ReadonlyArray<DetectedMarkerCorners>,
  config: AprilCubeConfig,
): AprilCubeCorrespondencesResult {
  if (!isValidAprilCubeConfig(config)) {
    return {
      success: false,
      reason: "invalidConfig",
    };
  }

  if (markers.length === 0) {
    return {
      success: false,
      reason: "notEnoughCorners",
    };
  }

  if (hasDuplicateMarkerId(markers)) {
    return {
      success: false,
      reason: "duplicateMarkerId",
    };
  }

  const invalidCornerCountMarker = findInvalidCornerCountMarker(markers);

  if (invalidCornerCountMarker !== null) {
    return {
      success: false,
      reason: "invalidCornerCount",
    };
  }

  const configuredMarkerIds = new Set<number>(
    Object.keys(config.faces).map((markerIdText) => Number(markerIdText)),
  );
  const unknownMarkerId = findUnknownMarkerId(markers, configuredMarkerIds);

  if (unknownMarkerId !== null) {
    return {
      success: false,
      reason: "unknownMarkerId",
    };
  }

  const objectPointMap = buildAprilCubeObjectPointMapUnchecked(config);
  const cornerOrderName = config.cornerOrder ?? DEFAULT_APRILCUBE_CORNER_ORDER;
  const sortedMarkers = sortMarkersById(markers);

  const imagePoints: ImagePoint2D[] = [];
  const objectPoints: ObjectPoint3D[] = [];
  const markerIds: number[] = [];
  const cornerIndices: number[] = [];

  for (const marker of sortedMarkers) {
    const markerObjectPoints = objectPointMap[marker.id];

    if (markerObjectPoints === undefined) {
      return {
        success: false,
        reason: "unknownMarkerId",
      };
    }

    const normalizedCorners = normalizeMarkerCornerOrder(marker.corners, cornerOrderName);

    for (let cornerIndex = 0; cornerIndex < MARKER_CORNER_COUNT; cornerIndex += 1) {
      const imagePoint = normalizedCorners[cornerIndex];
      const objectPoint = markerObjectPoints[cornerIndex];

      if (imagePoint === undefined || objectPoint === undefined) {
        return {
          success: false,
          reason: "invalidCornerCount",
        };
      }

      if (hasObjectPointAlready(objectPoints, objectPoint)) {
        continue;
      }

      imagePoints.push(imagePoint);
      objectPoints.push(objectPoint);
      markerIds.push(marker.id);
      cornerIndices.push(cornerIndex);
    }
  }

  if (imagePoints.length < MINIMUM_APRILCUBE_CORRESPONDENCE_COUNT) {
    return {
      success: false,
      reason: "notEnoughCorners",
    };
  }

  return {
    success: true,
    imagePoints,
    objectPoints,
    markerIds,
    cornerIndices,
  };
}
