/**
 * Parses AprilCube official cuboid config.json into AprilCubeConfig and metadata.
 */
import type {
  AprilCubeConfig,
  AprilCubeCornerOrderName,
  AprilCubeCuboidLayout,
  AprilCubeFaceName,
} from "./types.js";

/** Millimeters per meter for layout JSON unit conversion. */
const MILLIMETERS_PER_METER = 1000;

const GRID_DIMENSION_COUNT = 3;

const FACE_AXIS_TO_APRILCUBE_FACE: Readonly<Record<string, AprilCubeFaceName>> = {
  "+X": "right",
  "-X": "left",
  "+Y": "bottom",
  "-Y": "top",
  "+Z": "front",
  "-Z": "back",
};

/** Successful parse of an official AprilCube cuboid config.json. */
export interface AprilCubeCuboidConfigParseSuccess {
  readonly success: true;
  readonly config: AprilCubeConfig;
  readonly dictionaryName: string;
  readonly tagIds: ReadonlyArray<number>;
  readonly boxDimensionsMillimeters: readonly [number, number, number];
}

/** Failed parse of an official AprilCube cuboid config.json. */
export interface AprilCubeCuboidConfigParseFailure {
  readonly success: false;
  readonly reason:
    | "invalidJson"
    | "unsupportedSchema"
    | "missingField"
    | "invalidField";
  readonly detail: string;
}

/** Result of parseAprilCubeCuboidConfigJson. */
export type AprilCubeCuboidConfigParseResult =
  | AprilCubeCuboidConfigParseSuccess
  | AprilCubeCuboidConfigParseFailure;

/** Converts millimeters to meters for kibo-track object-space units. */
export function convertMillimetersToMeters(sizeMillimeters: number): number {
  return sizeMillimeters / MILLIMETERS_PER_METER;
}

/** Parses AprilCube grid string "WxHxD" into tag counts per axis. */
export function parseAprilCubeGridString(
  gridString: string,
): readonly [number, number, number] {
  const gridParts = gridString.split("x").map((part) => Number(part));

  if (
    gridParts.length !== GRID_DIMENSION_COUNT ||
    gridParts.some((part) => !Number.isInteger(part) || part < 1)
  ) {
    throw new RangeError(`Invalid AprilCube grid string: ${gridString}`);
  }

  return [gridParts[0]!, gridParts[1]!, gridParts[2]!];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringField(
  record: Record<string, unknown>,
  fieldName: string,
): string | null {
  const fieldValue = record[fieldName];

  if (typeof fieldValue !== "string" || fieldValue.length === 0) {
    return null;
  }

  return fieldValue;
}

function readNumberField(
  record: Record<string, unknown>,
  fieldName: string,
): number | null {
  const fieldValue = record[fieldName];

  if (typeof fieldValue !== "number" || !Number.isFinite(fieldValue)) {
    return null;
  }

  return fieldValue;
}

function readIntegerArrayField(
  record: Record<string, unknown>,
  fieldName: string,
): number[] | null {
  const fieldValue = record[fieldName];

  if (!Array.isArray(fieldValue) || fieldValue.length === 0) {
    return null;
  }

  const integerValues: number[] = [];

  for (const entry of fieldValue) {
    if (typeof entry !== "number" || !Number.isInteger(entry)) {
      return null;
    }

    integerValues.push(entry);
  }

  return integerValues;
}

function readBoxDimensionsMillimeters(
  record: Record<string, unknown>,
): readonly [number, number, number] | null {
  const fieldValue = record.box_dims;

  if (!Array.isArray(fieldValue) || fieldValue.length !== 3) {
    return null;
  }

  const dimensions: number[] = [];

  for (const entry of fieldValue) {
    if (typeof entry !== "number" || !Number.isFinite(entry) || entry <= 0) {
      return null;
    }

    dimensions.push(entry);
  }

  return [dimensions[0]!, dimensions[1]!, dimensions[2]!];
}

function readFaceAxisMap(
  record: Record<string, unknown>,
): Record<string, number[]> | null {
  const fieldValue = record.faces;

  if (!isRecord(fieldValue)) {
    return null;
  }

  const faceAxisMap: Record<string, number[]> = {};

  for (const [faceAxisLabel, markerIdsValue] of Object.entries(fieldValue)) {
    if (!Array.isArray(markerIdsValue) || markerIdsValue.length === 0) {
      return null;
    }

    const markerIds: number[] = [];

    for (const markerId of markerIdsValue) {
      if (typeof markerId !== "number" || !Number.isInteger(markerId)) {
        return null;
      }

      markerIds.push(markerId);
    }

    faceAxisMap[faceAxisLabel] = markerIds;
  }

  if (Object.keys(faceAxisMap).length === 0) {
    return null;
  }

  return faceAxisMap;
}

function hasExplicitMarkerGeometry(record: Record<string, unknown>): boolean {
  const markersValue = record.markers;

  if (!Array.isArray(markersValue) || markersValue.length === 0) {
    return false;
  }

  for (const markerEntry of markersValue) {
    if (!isRecord(markerEntry)) {
      continue;
    }

    if (Array.isArray(markerEntry.corners_mm) && markerEntry.corners_mm.length > 0) {
      return true;
    }

    if (Array.isArray(markerEntry.corners) && markerEntry.corners.length > 0) {
      return true;
    }
  }

  return false;
}

function computeReferenceCubeSizeMeters(
  boxDimensionsMillimeters: readonly [number, number, number],
): number {
  const maxBoxDimensionMillimeters = Math.max(
    boxDimensionsMillimeters[0],
    boxDimensionsMillimeters[1],
    boxDimensionsMillimeters[2],
  );

  return convertMillimetersToMeters(maxBoxDimensionMillimeters);
}

function buildCuboidLayoutFromParsedJson(
  gridString: string,
  tagIds: readonly number[],
  tagSizeMillimeters: number,
  cellSizeMillimeters: number,
  marginCells: number,
  borderCells: number,
  markerPixels: number,
  boxDimensionsMillimeters: readonly [number, number, number],
): AprilCubeCuboidLayout {
  return {
    grid: parseAprilCubeGridString(gridString),
    tagIds: [...tagIds],
    tagSizeMeters: convertMillimetersToMeters(tagSizeMillimeters),
    cellSizeMeters: convertMillimetersToMeters(cellSizeMillimeters),
    marginCells,
    borderCells,
    markerPixels,
    boxDimensionsMeters: [
      convertMillimetersToMeters(boxDimensionsMillimeters[0]),
      convertMillimetersToMeters(boxDimensionsMillimeters[1]),
      convertMillimetersToMeters(boxDimensionsMillimeters[2]),
    ],
  };
}

function buildFaceMapFromAxisAssignments(
  faceAxisMap: Record<string, number[]>,
): Record<number, AprilCubeFaceName> {
  const faceMap: Record<number, AprilCubeFaceName> = {};

  for (const [faceAxisLabel, markerIds] of Object.entries(faceAxisMap)) {
    const aprilCubeFaceName = FACE_AXIS_TO_APRILCUBE_FACE[faceAxisLabel];

    if (aprilCubeFaceName === undefined) {
      throw new RangeError(`Unsupported face axis label: ${faceAxisLabel}`);
    }

    for (const markerId of markerIds) {
      faceMap[markerId] = aprilCubeFaceName;
    }
  }

  return faceMap;
}

/** Parses official AprilCube cuboid config.json into AprilCubeConfig. */
export function parseAprilCubeCuboidConfigJson(
  rawJson: unknown,
  cornerOrder: AprilCubeCornerOrderName = "canonical",
): AprilCubeCuboidConfigParseResult {
  if (!isRecord(rawJson)) {
    return {
      success: false,
      reason: "invalidJson",
      detail: "Expected a JSON object.",
    };
  }

  if (hasExplicitMarkerGeometry(rawJson)) {
    return {
      success: false,
      reason: "unsupportedSchema",
      detail: "Explicit marker geometry (markers[].corners_mm) is not supported for cuboid parsing.",
    };
  }

  const gridString = readStringField(rawJson, "grid");
  const dictionaryName = readStringField(rawJson, "dict");
  const tagIds = readIntegerArrayField(rawJson, "tag_ids");
  const faceAxisMap = readFaceAxisMap(rawJson);
  const tagSizeMillimeters = readNumberField(rawJson, "tag_size_mm");
  const cellSizeMillimeters = readNumberField(rawJson, "cell_size_mm");
  const marginCells = readNumberField(rawJson, "margin_cells");
  const borderCells = readNumberField(rawJson, "border_cells");
  const markerPixels = readNumberField(rawJson, "marker_pixels");
  const boxDimensionsMillimeters = readBoxDimensionsMillimeters(rawJson);

  if (gridString === null) {
    return { success: false, reason: "missingField", detail: "Missing or invalid grid." };
  }

  if (dictionaryName === null) {
    return { success: false, reason: "missingField", detail: "Missing or invalid dict." };
  }

  if (tagIds === null) {
    return { success: false, reason: "missingField", detail: "Missing or invalid tag_ids." };
  }

  if (faceAxisMap === null) {
    return { success: false, reason: "missingField", detail: "Missing or invalid faces." };
  }

  if (tagSizeMillimeters === null || tagSizeMillimeters <= 0) {
    return { success: false, reason: "missingField", detail: "Missing or invalid tag_size_mm." };
  }

  if (cellSizeMillimeters === null || cellSizeMillimeters <= 0) {
    return { success: false, reason: "missingField", detail: "Missing or invalid cell_size_mm." };
  }

  if (marginCells === null || !Number.isInteger(marginCells) || marginCells < 0) {
    return { success: false, reason: "missingField", detail: "Missing or invalid margin_cells." };
  }

  if (borderCells === null || !Number.isInteger(borderCells) || borderCells < 0) {
    return { success: false, reason: "missingField", detail: "Missing or invalid border_cells." };
  }

  if (markerPixels === null || !Number.isInteger(markerPixels) || markerPixels <= 0) {
    return { success: false, reason: "missingField", detail: "Missing or invalid marker_pixels." };
  }

  if (boxDimensionsMillimeters === null) {
    return { success: false, reason: "missingField", detail: "Missing or invalid box_dims." };
  }

  let faceMap: Record<number, AprilCubeFaceName>;

  try {
    faceMap = buildFaceMapFromAxisAssignments(faceAxisMap);
  } catch (error) {
    return {
      success: false,
      reason: "invalidField",
      detail: error instanceof Error ? error.message : "Invalid faces mapping.",
    };
  }

  let cuboidLayout: AprilCubeCuboidLayout;

  try {
    cuboidLayout = buildCuboidLayoutFromParsedJson(
      gridString,
      tagIds,
      tagSizeMillimeters,
      cellSizeMillimeters,
      marginCells,
      borderCells,
      markerPixels,
      boxDimensionsMillimeters,
    );
  } catch (error) {
    return {
      success: false,
      reason: "invalidField",
      detail: error instanceof Error ? error.message : "Invalid cuboid layout fields.",
    };
  }

  const config: AprilCubeConfig = {
    cubeSize: computeReferenceCubeSizeMeters(boxDimensionsMillimeters),
    faces: faceMap,
    cornerOrder,
    cuboidLayout,
  };

  return {
    success: true,
    config,
    dictionaryName,
    tagIds,
    boxDimensionsMillimeters,
  };
}
