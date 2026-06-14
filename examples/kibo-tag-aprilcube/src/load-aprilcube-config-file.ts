/**
 * Loads official AprilCube cuboid config.json for the browser example.
 */
import {
  parseAprilCubeCuboidConfigJson,
  type AprilCubeConfig,
} from "kibo-track";
import { mapAprilCubeDictionaryToKiboTagFamily } from "./map-aprilcube-dict-to-kibo-tag.js";
import type { CornerOrderSelection } from "./types.js";

export interface LoadedAprilCubeModelConfig {
  readonly configLabel: string;
  readonly aprilCubeConfig: AprilCubeConfig;
  readonly dictionaryName: string;
  readonly kiboTagFamilyName: string;
  readonly tagIds: ReadonlyArray<number>;
  readonly configuredTagIdSet: ReadonlySet<number>;
  readonly boxDimensionsMeters: readonly [number, number, number];
}

export interface LoadAprilCubeConfigFileSuccess {
  readonly success: true;
  readonly loadedConfig: LoadedAprilCubeModelConfig;
}

export interface LoadAprilCubeConfigFileFailure {
  readonly success: false;
  readonly detail: string;
}

export type LoadAprilCubeConfigFileResult =
  | LoadAprilCubeConfigFileSuccess
  | LoadAprilCubeConfigFileFailure;

function readConfigLabelFromFileName(fileName: string): string {
  const normalizedFileName = fileName.trim();

  if (normalizedFileName.length === 0) {
    return "unknown-config";
  }

  return normalizedFileName.replace(/\.json$/i, "");
}

/** Parses AprilCube config JSON text into loaded example runtime config. */
export function parseAprilCubeConfigJsonText(
  configJsonText: string,
  configLabel: string,
  cornerOrder: CornerOrderSelection = "reversedCanonical",
): LoadAprilCubeConfigFileResult {
  let rawJson: unknown;

  try {
    rawJson = JSON.parse(configJsonText) as unknown;
  } catch (error) {
    return {
      success: false,
      detail: error instanceof Error ? error.message : "Invalid JSON text.",
    };
  }

  const parseResult = parseAprilCubeCuboidConfigJson(rawJson, cornerOrder);

  if (!parseResult.success) {
    return {
      success: false,
      detail: `${parseResult.reason}: ${parseResult.detail}`,
    };
  }

  const cuboidLayout = parseResult.config.cuboidLayout;

  if (cuboidLayout === undefined) {
    return {
      success: false,
      detail: "Parsed config is missing cuboidLayout.",
    };
  }

  const dictionaryMappingResult = mapAprilCubeDictionaryToKiboTagFamily(
    parseResult.dictionaryName,
  );

  if (!dictionaryMappingResult.success) {
    return {
      success: false,
      detail: dictionaryMappingResult.detail,
    };
  }

  return {
    success: true,
    loadedConfig: {
      configLabel,
      aprilCubeConfig: parseResult.config,
      dictionaryName: parseResult.dictionaryName,
      kiboTagFamilyName: dictionaryMappingResult.kiboTagFamilyName,
      tagIds: parseResult.tagIds,
      configuredTagIdSet: new Set(parseResult.tagIds),
      boxDimensionsMeters: [
        cuboidLayout.boxDimensionsMeters[0],
        cuboidLayout.boxDimensionsMeters[1],
        cuboidLayout.boxDimensionsMeters[2],
      ],
    },
  };
}

/** Reads an AprilCube config.json File object from a file picker. */
export async function loadAprilCubeConfigFromFile(
  configFile: File,
  cornerOrder: CornerOrderSelection = "reversedCanonical",
): Promise<LoadAprilCubeConfigFileResult> {
  const configJsonText = await configFile.text();
  const configLabel = readConfigLabelFromFileName(configFile.name);

  return parseAprilCubeConfigJsonText(configJsonText, configLabel, cornerOrder);
}

/** Loads AprilCube config JSON from a URL (static verifier / tests). */
export async function loadAprilCubeConfigFromUrl(
  configUrl: string,
  cornerOrder: CornerOrderSelection = "reversedCanonical",
): Promise<LoadAprilCubeConfigFileResult> {
  let response: Response;

  try {
    response = await fetch(configUrl);
  } catch (error) {
    return {
      success: false,
      detail: error instanceof Error ? error.message : "Failed to fetch config URL.",
    };
  }

  if (!response.ok) {
    return {
      success: false,
      detail: `Failed to fetch config URL (${response.status}).`,
    };
  }

  const configJsonText = await response.text();
  const configLabel = readConfigLabelFromFileName(configUrl.split("/").pop() ?? "config");

  return parseAprilCubeConfigJsonText(configJsonText, configLabel, cornerOrder);
}
