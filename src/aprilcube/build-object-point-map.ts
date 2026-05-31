/**
 * Builds per-marker 3D object corner maps from AprilCube configuration.
 */
import type { ObjectPoint3D } from "../core/types.js";
import { buildFaceObjectCorners } from "./cube-corners.js";
import { buildAprilCubeTagCornerObjectPointMap } from "./tag-corners.js";
import { isValidAprilCubeConfig } from "./validate-config.js";
import type { AprilCubeConfig, AprilCubeObjectPointMap } from "./types.js";

/** Builds a marker-ID keyed 3D corner map. Caller must validate config first. */
export function buildAprilCubeObjectPointMapUnchecked(
  config: AprilCubeConfig,
): AprilCubeObjectPointMap {
  if (config.cuboidLayout !== undefined) {
    return buildAprilCubeTagCornerObjectPointMap(config);
  }

  const objectPointMap: Record<number, readonly ObjectPoint3D[]> = {};

  for (const [markerIdText, faceName] of Object.entries(config.faces)) {
    const markerId = Number(markerIdText);
    objectPointMap[markerId] = buildFaceObjectCorners(faceName, config.cubeSize);
  }

  return objectPointMap;
}

/** Builds a marker-ID keyed 3D corner map with cube center at the origin. */
export function buildAprilCubeObjectPointMap(
  config: AprilCubeConfig,
): AprilCubeObjectPointMap {
  if (!isValidAprilCubeConfig(config)) {
    throw new RangeError("AprilCube configuration is invalid.");
  }

  return buildAprilCubeObjectPointMapUnchecked(config);
}
