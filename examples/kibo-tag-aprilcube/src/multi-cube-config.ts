/**
 * Multi-cube AprilCube config set: 16 independent 1x1x1_24_cube fixtures with disjoint tag IDs.
 */
import { buildPublicAssetPath } from "./public-asset-path.js";
import {
  MULTI_CUBE_CONFIG_COUNT,
  MULTI_CUBE_CONFIG_FIXTURE_FILENAMES,
  MULTI_CUBE_TAGS_PER_CUBE,
} from "./constants.js";
import {
  parseAprilCubeConfigJsonText,
  type LoadedAprilCubeModelConfig,
} from "./load-aprilcube-config-file.js";
import type { CornerOrderSelection } from "./types.js";
import type { DetectedMarkerCorners } from "kibo-track";

/** Resolved set of 16 AprilCube configs and partition metadata. */
export interface MultiCubeConfigSet {
  readonly cubeCount: number;
  readonly cubes: ReadonlyArray<LoadedAprilCubeModelConfig>;
  readonly idToCubeIndex: ReadonlyMap<number, number>;
  readonly unionTagIdSet: ReadonlySet<number>;
  readonly kiboTagFamilyName: string;
}

export interface MultiCubeConfigLoadSuccess {
  readonly success: true;
  readonly configSet: MultiCubeConfigSet;
}

export interface MultiCubeConfigLoadFailure {
  readonly success: false;
  readonly detail: string;
}

export type MultiCubeConfigLoadResult =
  | MultiCubeConfigLoadSuccess
  | MultiCubeConfigLoadFailure;

/** Builds the public URL for a multi-cube fixture by cube index. */
export function buildMultiCubeConfigFixtureUrl(
  cubeIndex: number,
  baseUrl: string = import.meta.env.BASE_URL,
): string {
  const fileName = MULTI_CUBE_CONFIG_FIXTURE_FILENAMES[cubeIndex];

  if (fileName === undefined) {
    throw new RangeError(`Multi-cube fixture for cube index ${cubeIndex} is missing.`);
  }

  return buildPublicAssetPath(`aprilcube-fixtures/multi-cube/${fileName}`, baseUrl);
}

/** Partitions detected markers by cube index using the precomputed idToCubeIndex map. */
export function partitionDetectedMarkersByCubeIndex(
  detectedMarkers: ReadonlyArray<DetectedMarkerCorners>,
  idToCubeIndex: ReadonlyMap<number, number>,
  cubeCount: number,
): DetectedMarkerCorners[][] {
  const partitions: DetectedMarkerCorners[][] = Array.from(
    { length: cubeCount },
    () => [],
  );

  for (const marker of detectedMarkers) {
    const cubeIndex = idToCubeIndex.get(marker.id);

    if (cubeIndex === undefined) {
      continue;
    }

    const partition = partitions[cubeIndex];

    if (partition === undefined) {
      continue;
    }

    partition.push(marker);
  }

  return partitions;
}

/** Builds a MultiCubeConfigSet from already-parsed per-cube loaded configs. */
export function buildMultiCubeConfigSetFromLoaded(
  loadedConfigs: ReadonlyArray<LoadedAprilCubeModelConfig>,
): MultiCubeConfigLoadResult {
  if (loadedConfigs.length !== MULTI_CUBE_CONFIG_COUNT) {
    return {
      success: false,
      detail: `Expected ${MULTI_CUBE_CONFIG_COUNT} configs, received ${loadedConfigs.length}.`,
    };
  }

  const idToCubeIndex = new Map<number, number>();
  const unionTagIdSet = new Set<number>();
  let kiboTagFamilyName: string | null = null;

  for (let cubeIndex = 0; cubeIndex < loadedConfigs.length; cubeIndex += 1) {
    const loadedConfig = loadedConfigs[cubeIndex];

    if (loadedConfig === undefined) {
      return {
        success: false,
        detail: `Missing loaded config at cube index ${cubeIndex}.`,
      };
    }

    if (loadedConfig.tagIds.length !== MULTI_CUBE_TAGS_PER_CUBE) {
      return {
        success: false,
        detail: `Cube ${cubeIndex} (${loadedConfig.configLabel}) has ${loadedConfig.tagIds.length} tag ids, expected ${MULTI_CUBE_TAGS_PER_CUBE}.`,
      };
    }

    if (kiboTagFamilyName === null) {
      kiboTagFamilyName = loadedConfig.kiboTagFamilyName;
    } else if (loadedConfig.kiboTagFamilyName !== kiboTagFamilyName) {
      return {
        success: false,
        detail: `Cube ${cubeIndex} (${loadedConfig.configLabel}) dict ${loadedConfig.kiboTagFamilyName} does not match first cube ${kiboTagFamilyName}.`,
      };
    }

    for (const tagId of loadedConfig.tagIds) {
      if (idToCubeIndex.has(tagId)) {
        const priorCubeIndex = idToCubeIndex.get(tagId);

        return {
          success: false,
          detail: `Tag id ${tagId} appears in both cube ${priorCubeIndex} and cube ${cubeIndex}.`,
        };
      }

      idToCubeIndex.set(tagId, cubeIndex);
      unionTagIdSet.add(tagId);
    }
  }

  if (kiboTagFamilyName === null) {
    return {
      success: false,
      detail: "No kibo-tag family resolved from multi-cube configs.",
    };
  }

  return {
    success: true,
    configSet: {
      cubeCount: loadedConfigs.length,
      cubes: loadedConfigs,
      idToCubeIndex,
      unionTagIdSet,
      kiboTagFamilyName,
    },
  };
}

/** Parses 16 fixture JSON texts (in cube-index order) into a MultiCubeConfigSet. */
export function parseMultiCubeConfigJsonTexts(
  configJsonTexts: ReadonlyArray<string>,
  configLabels: ReadonlyArray<string>,
  cornerOrder: CornerOrderSelection = "reversedCanonical",
): MultiCubeConfigLoadResult {
  if (configJsonTexts.length !== MULTI_CUBE_CONFIG_COUNT) {
    return {
      success: false,
      detail: `Expected ${MULTI_CUBE_CONFIG_COUNT} config texts, received ${configJsonTexts.length}.`,
    };
  }

  if (configLabels.length !== MULTI_CUBE_CONFIG_COUNT) {
    return {
      success: false,
      detail: `Expected ${MULTI_CUBE_CONFIG_COUNT} config labels, received ${configLabels.length}.`,
    };
  }

  const loadedConfigs: LoadedAprilCubeModelConfig[] = [];

  for (let cubeIndex = 0; cubeIndex < MULTI_CUBE_CONFIG_COUNT; cubeIndex += 1) {
    const configJsonText = configJsonTexts[cubeIndex];
    const configLabel = configLabels[cubeIndex];

    if (configJsonText === undefined || configLabel === undefined) {
      return {
        success: false,
        detail: `Missing config text or label at cube index ${cubeIndex}.`,
      };
    }

    const parseResult = parseAprilCubeConfigJsonText(
      configJsonText,
      configLabel,
      cornerOrder,
    );

    if (!parseResult.success) {
      return {
        success: false,
        detail: `Cube ${cubeIndex} (${configLabel}): ${parseResult.detail}`,
      };
    }

    loadedConfigs.push(parseResult.loadedConfig);
  }

  return buildMultiCubeConfigSetFromLoaded(loadedConfigs);
}

/** Fetches and parses the 16 multi-cube fixture configs from the public directory. */
export async function loadMultiCubeConfigSet(
  cornerOrder: CornerOrderSelection = "reversedCanonical",
  baseUrl: string = import.meta.env.BASE_URL,
): Promise<MultiCubeConfigLoadResult> {
  const configJsonTexts: string[] = [];
  const configLabels: string[] = [];

  for (let cubeIndex = 0; cubeIndex < MULTI_CUBE_CONFIG_COUNT; cubeIndex += 1) {
    const fixtureUrl = buildMultiCubeConfigFixtureUrl(cubeIndex, baseUrl);
    const fixtureFileName = MULTI_CUBE_CONFIG_FIXTURE_FILENAMES[cubeIndex];

    if (fixtureFileName === undefined) {
      return {
        success: false,
        detail: `Missing fixture filename for cube index ${cubeIndex}.`,
      };
    }

    let response: Response;

    try {
      response = await fetch(fixtureUrl);
    } catch (error) {
      return {
        success: false,
        detail: `Cube ${cubeIndex} fetch failed: ${error instanceof Error ? error.message : "unknown"}`,
      };
    }

    if (!response.ok) {
      return {
        success: false,
        detail: `Cube ${cubeIndex} fetch returned ${response.status} for ${fixtureUrl}`,
      };
    }

    configJsonTexts.push(await response.text());
    configLabels.push(fixtureFileName.replace(/\.json$/i, ""));
  }

  return parseMultiCubeConfigJsonTexts(
    configJsonTexts,
    configLabels,
    cornerOrder,
  );
}
