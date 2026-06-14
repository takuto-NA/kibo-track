/**
 * Stick 1x1x6 AprilCube official config fixtures for adapter tests.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseAprilCubeCuboidConfigJson } from "../../src/aprilcube/parse-cuboid-config-json.js";
import type { AprilCubeConfig } from "../../src/aprilcube/types.js";

const OFFICIAL_FIXTURE_DIRECTORY = join(
  process.cwd(),
  "tests",
  "fixtures",
  "aprilcube-official",
);

export const STICK_1X1X6_CONFIG_JSON_PATH = join(
  OFFICIAL_FIXTURE_DIRECTORY,
  "stick-1x1x6-config.json",
);

export const ONE_BY_ONE_BY_ONE_24_CONFIG_JSON_PATH = join(
  OFFICIAL_FIXTURE_DIRECTORY,
  "1x1x1-24-config.json",
);

export const L_SHAPE_V2_CONFIG_JSON_PATH = join(
  OFFICIAL_FIXTURE_DIRECTORY,
  "l-shape-v2-config.json",
);

function readOfficialConfigJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
}

function parseOfficialConfigOrThrow(filePath: string): AprilCubeConfig {
  const parseResult = parseAprilCubeCuboidConfigJson(readOfficialConfigJson(filePath));

  if (!parseResult.success) {
    throw new Error(
      `Failed to parse official AprilCube config fixture: ${parseResult.reason} ${parseResult.detail}`,
    );
  }

  return parseResult.config;
}

/** Parsed AprilCubeConfig for stick_1x1x6 official JSON. */
export const STICK_1X1X6_APRILCUBE_CONFIG: AprilCubeConfig = parseOfficialConfigOrThrow(
  STICK_1X1X6_CONFIG_JSON_PATH,
);

/** Marker on +X face at the +Z end of the stick (tag id 5). */
export const STICK_MARKER_ID_PLUS_X_END = 5;

/** Marker on +Z face at the +Z end cap (tag id 24). */
export const STICK_MARKER_ID_PLUS_Z_END = 24;

/** Golden tag corners for stick marker 5 (+X, row 5 on +X face), meters, [TL, TR, BR, BL]. */
export const STICK_TAG_CORNERS_PLUS_X_END_METERS: readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
] = [
  [0.02, -0.015, -0.0725],
  [0.02, 0.015, -0.0725],
  [0.02, 0.015, -0.1025],
  [0.02, -0.015, -0.1025],
];

/** Golden tag corners for stick marker 24 (+Z end cap), meters, [TL, TR, BR, BL]. */
export const STICK_TAG_CORNERS_PLUS_Z_END_METERS: readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
] = [
  [0.015, -0.015, 0.1075],
  [-0.015, -0.015, 0.1075],
  [-0.015, 0.015, 0.1075],
  [0.015, 0.015, 0.1075],
];

export function readStickOfficialConfigJson(): unknown {
  return readOfficialConfigJson(STICK_1X1X6_CONFIG_JSON_PATH);
}

export function readOneByOneByOne24OfficialConfigJson(): unknown {
  return readOfficialConfigJson(ONE_BY_ONE_BY_ONE_24_CONFIG_JSON_PATH);
}

export function readLShapeV2OfficialConfigJson(): unknown {
  return readOfficialConfigJson(L_SHAPE_V2_CONFIG_JSON_PATH);
}
