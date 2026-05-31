/**
 * Generates center-origin AprilCube face object corners in canonical order.
 */
import type { ObjectPoint3D } from "../core/types.js";
import type { AprilCubeFaceName } from "./types.js";

/** Four object corners in canonical order for one cube face. */
export type FaceObjectCorners = readonly [
  ObjectPoint3D,
  ObjectPoint3D,
  ObjectPoint3D,
  ObjectPoint3D,
];

function computeHalfCubeSize(cubeSize: number): number {
  return cubeSize / 2;
}

function buildFrontFaceCorners(halfCubeSize: number): FaceObjectCorners {
  return [
    [-halfCubeSize, -halfCubeSize, halfCubeSize],
    [halfCubeSize, -halfCubeSize, halfCubeSize],
    [halfCubeSize, halfCubeSize, halfCubeSize],
    [-halfCubeSize, halfCubeSize, halfCubeSize],
  ];
}

function buildBackFaceCorners(halfCubeSize: number): FaceObjectCorners {
  return [
    [halfCubeSize, -halfCubeSize, -halfCubeSize],
    [-halfCubeSize, -halfCubeSize, -halfCubeSize],
    [-halfCubeSize, halfCubeSize, -halfCubeSize],
    [halfCubeSize, halfCubeSize, -halfCubeSize],
  ];
}

function buildRightFaceCorners(halfCubeSize: number): FaceObjectCorners {
  return [
    [halfCubeSize, -halfCubeSize, halfCubeSize],
    [halfCubeSize, -halfCubeSize, -halfCubeSize],
    [halfCubeSize, halfCubeSize, -halfCubeSize],
    [halfCubeSize, halfCubeSize, halfCubeSize],
  ];
}

function buildLeftFaceCorners(halfCubeSize: number): FaceObjectCorners {
  return [
    [-halfCubeSize, -halfCubeSize, -halfCubeSize],
    [-halfCubeSize, -halfCubeSize, halfCubeSize],
    [-halfCubeSize, halfCubeSize, halfCubeSize],
    [-halfCubeSize, halfCubeSize, -halfCubeSize],
  ];
}

function buildBottomFaceCorners(halfCubeSize: number): FaceObjectCorners {
  return [
    [-halfCubeSize, halfCubeSize, halfCubeSize],
    [halfCubeSize, halfCubeSize, halfCubeSize],
    [halfCubeSize, halfCubeSize, -halfCubeSize],
    [-halfCubeSize, halfCubeSize, -halfCubeSize],
  ];
}

function buildTopFaceCorners(halfCubeSize: number): FaceObjectCorners {
  return [
    [-halfCubeSize, -halfCubeSize, -halfCubeSize],
    [halfCubeSize, -halfCubeSize, -halfCubeSize],
    [halfCubeSize, -halfCubeSize, halfCubeSize],
    [-halfCubeSize, -halfCubeSize, halfCubeSize],
  ];
}

/** Returns canonical object corners for one named cube face. */
export function buildFaceObjectCorners(
  faceName: AprilCubeFaceName,
  cubeSize: number,
): FaceObjectCorners {
  const halfCubeSize = computeHalfCubeSize(cubeSize);

  if (faceName === "front") {
    return buildFrontFaceCorners(halfCubeSize);
  }

  if (faceName === "back") {
    return buildBackFaceCorners(halfCubeSize);
  }

  if (faceName === "right") {
    return buildRightFaceCorners(halfCubeSize);
  }

  if (faceName === "left") {
    return buildLeftFaceCorners(halfCubeSize);
  }

  if (faceName === "bottom") {
    return buildBottomFaceCorners(halfCubeSize);
  }

  return buildTopFaceCorners(halfCubeSize);
}

/** Returns the expected face center for one named cube face. */
export function computeFaceCenter(
  faceName: AprilCubeFaceName,
  cubeSize: number,
): ObjectPoint3D {
  const halfCubeSize = computeHalfCubeSize(cubeSize);

  if (faceName === "front") {
    return [0, 0, halfCubeSize];
  }

  if (faceName === "back") {
    return [0, 0, -halfCubeSize];
  }

  if (faceName === "right") {
    return [halfCubeSize, 0, 0];
  }

  if (faceName === "left") {
    return [-halfCubeSize, 0, 0];
  }

  if (faceName === "bottom") {
    return [0, halfCubeSize, 0];
  }

  return [0, -halfCubeSize, 0];
}
