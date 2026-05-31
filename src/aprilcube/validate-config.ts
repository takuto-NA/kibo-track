/**
 * Validates AprilCube configuration before correspondence assembly.
 */
import type { AprilCubeConfig, AprilCubeFaceName } from "./types.js";

const VALID_FACE_NAMES: ReadonlySet<AprilCubeFaceName> = new Set([
  "front",
  "back",
  "left",
  "right",
  "top",
  "bottom",
]);

function isValidFaceName(value: string): value is AprilCubeFaceName {
  return VALID_FACE_NAMES.has(value as AprilCubeFaceName);
}

function isValidMarkerId(markerIdText: string): boolean {
  const markerId = Number(markerIdText);

  if (!Number.isInteger(markerId)) {
    return false;
  }

  return Number.isFinite(markerId);
}

function hasDuplicateFaceAssignment(
  faceMap: AprilCubeConfig["faces"],
): boolean {
  const assignedFaces = new Set<AprilCubeFaceName>();

  for (const faceName of Object.values(faceMap)) {
    if (assignedFaces.has(faceName)) {
      return true;
    }

    assignedFaces.add(faceName);
  }

  return false;
}

/** Returns whether the AprilCube config is valid for correspondence building. */
export function isValidAprilCubeConfig(config: AprilCubeConfig): boolean {
  if (!Number.isFinite(config.cubeSize) || config.cubeSize <= 0) {
    return false;
  }

  const faceEntries = Object.entries(config.faces);

  if (faceEntries.length === 0) {
    return false;
  }

  for (const [markerIdText, faceName] of faceEntries) {
    if (!isValidMarkerId(markerIdText)) {
      return false;
    }

    if (!isValidFaceName(faceName)) {
      return false;
    }
  }

  if (hasDuplicateFaceAssignment(config.faces)) {
    return false;
  }

  return true;
}
