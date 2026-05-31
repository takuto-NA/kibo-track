/**
 * Groups AprilCube 2D–3D correspondences by marker ID for per-marker pose paths.
 */
import type { ImagePoint2D, ObjectPoint3D } from "../core/types.js";

export interface MarkerCorrespondenceSlice {
  readonly markerId: number;
  readonly imagePoints: ImagePoint2D[];
  readonly objectPoints: ObjectPoint3D[];
  readonly cornerIndices: number[];
  readonly correspondenceIndices: number[];
}

export interface SelectedMarkerCorrespondences {
  readonly imagePoints: ImagePoint2D[];
  readonly objectPoints: ObjectPoint3D[];
  readonly markerIds: number[];
  readonly cornerIndices: number[];
}

/** Returns unique marker IDs in first-seen order. */
export function getUniqueMarkerIds(markerIds: ReadonlyArray<number>): number[] {
  return [...new Set(markerIds)];
}

/** Returns the count of unique marker IDs. */
export function countUniqueMarkerIds(markerIds: ReadonlyArray<number>): number {
  return getUniqueMarkerIds(markerIds).length;
}

/** Builds one correspondence slice per detected marker ID. */
export function buildMarkerCorrespondenceSlices(
  imagePoints: ReadonlyArray<ImagePoint2D>,
  objectPoints: ReadonlyArray<ObjectPoint3D>,
  markerIds: ReadonlyArray<number>,
  cornerIndices: ReadonlyArray<number> = [],
): MarkerCorrespondenceSlice[] {
  const slicesByMarkerId = new Map<number, MarkerCorrespondenceSlice>();

  for (let correspondenceIndex = 0; correspondenceIndex < markerIds.length; correspondenceIndex += 1) {
    const markerId = markerIds[correspondenceIndex];
    const imagePoint = imagePoints[correspondenceIndex];
    const objectPoint = objectPoints[correspondenceIndex];
    const cornerIndex = cornerIndices[correspondenceIndex];

    if (markerId === undefined || imagePoint === undefined || objectPoint === undefined) {
      continue;
    }

    const existingSlice = slicesByMarkerId.get(markerId);

    if (existingSlice === undefined) {
      slicesByMarkerId.set(markerId, {
        markerId,
        imagePoints: [imagePoint],
        objectPoints: [objectPoint],
        cornerIndices: cornerIndex === undefined ? [] : [cornerIndex],
        correspondenceIndices: [correspondenceIndex],
      });
      continue;
    }

    existingSlice.imagePoints.push(imagePoint);
    existingSlice.objectPoints.push(objectPoint);

    if (cornerIndex !== undefined) {
      existingSlice.cornerIndices.push(cornerIndex);
    }

    existingSlice.correspondenceIndices.push(correspondenceIndex);
  }

  return [...slicesByMarkerId.values()];
}

/** Converts one marker slice into the selected-correspondences shape used by planar fallback. */
export function toSelectedMarkerCorrespondences(
  markerSlice: MarkerCorrespondenceSlice,
): SelectedMarkerCorrespondences {
  return {
    imagePoints: markerSlice.imagePoints,
    objectPoints: markerSlice.objectPoints,
    markerIds: markerSlice.imagePoints.map(() => markerSlice.markerId),
    cornerIndices: markerSlice.cornerIndices,
  };
}
