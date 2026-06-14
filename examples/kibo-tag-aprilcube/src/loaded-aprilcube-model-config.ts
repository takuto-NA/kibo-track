/**
 * Default and rebuilt AprilCube model config for the browser example runtime.
 */
import { EXAMPLE_APRILCUBE_LAYOUT_JSON } from "./aprilcube-config.js";
import {
  parseAprilCubeConfigJsonText,
  type LoadedAprilCubeModelConfig,
} from "./load-aprilcube-config-file.js";
import type { CornerOrderSelection } from "./types.js";

const DEFAULT_APRILCUBE_CONFIG_LABEL = "1x1x1_24_cube";
const MILLIMETERS_PER_METER = 1000;

function requireLoadedAprilCubeModelConfig(
  loadResult: ReturnType<typeof parseAprilCubeConfigJsonText>,
): LoadedAprilCubeModelConfig {
  if (!loadResult.success) {
    throw new Error(`Failed to resolve AprilCube model config: ${loadResult.detail}`);
  }

  return loadResult.loadedConfig;
}

/** Creates the default example AprilCube model config. */
export function createDefaultLoadedAprilCubeModelConfig(
  cornerOrder: CornerOrderSelection = "reversedCanonical",
): LoadedAprilCubeModelConfig {
  return requireLoadedAprilCubeModelConfig(
    parseAprilCubeConfigJsonText(
      JSON.stringify(EXAMPLE_APRILCUBE_LAYOUT_JSON),
      DEFAULT_APRILCUBE_CONFIG_LABEL,
      cornerOrder,
    ),
  );
}

/** Returns the JSON text used to rebuild config when corner order changes. */
export function readDefaultAprilCubeConfigJsonText(): string {
  return JSON.stringify(EXAMPLE_APRILCUBE_LAYOUT_JSON);
}

/** Rebuilds loaded config metadata from stored JSON text and corner order. */
export function rebuildLoadedAprilCubeModelConfig(
  configJsonText: string,
  configLabel: string,
  cornerOrder: CornerOrderSelection,
): LoadedAprilCubeModelConfig {
  return requireLoadedAprilCubeModelConfig(
    parseAprilCubeConfigJsonText(configJsonText, configLabel, cornerOrder),
  );
}

/** Returns max box dimension in meters for three.js overlay scaling. */
export function computeMaxBoxDimensionMeters(
  boxDimensionsMeters: readonly [number, number, number],
): number {
  return Math.max(
    boxDimensionsMeters[0],
    boxDimensionsMeters[1],
    boxDimensionsMeters[2],
  );
}

/** Formats loaded config metadata for the status UI. */
export function formatLoadedAprilCubeConfigStatus(
  loadedConfig: LoadedAprilCubeModelConfig,
): string {
  const boxDimensionsMillimeters = loadedConfig.boxDimensionsMeters.map(
    (dimensionMeters) => Math.round(dimensionMeters * MILLIMETERS_PER_METER),
  );

  return [
    `loaded: ${loadedConfig.configLabel}`,
    `dict=${loadedConfig.dictionaryName}`,
    `tags=${loadedConfig.tagIds.length}`,
    `box=${boxDimensionsMillimeters.join("x")}mm`,
  ].join(" | ");
}

export type { LoadedAprilCubeModelConfig };
