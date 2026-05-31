/**
 * Maps the printed AprilCube layout JSON to kibo-track AprilCubeConfig.
 */
import type { AprilCubeConfig, AprilCubeCuboidLayout, AprilCubeFaceName } from "kibo-track";
import type { AprilCubeLayoutJson, CornerOrderSelection } from "./types.js";

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

/** Example AprilCube layout JSON from the printed cube configuration. */
export const EXAMPLE_APRILCUBE_LAYOUT_JSON: AprilCubeLayoutJson = {
  dict: "4x4_100",
  grid: "1x1x1",
  tag_ids: [0, 1, 2, 3, 4, 5],
  faces: {
    "+X": [0],
    "-X": [1],
    "+Y": [2],
    "-Y": [3],
    "+Z": [4],
    "-Z": [5],
  },
  tag_size_mm: 24.0,
  cell_size_mm: 4.0,
  margin_cells: 1,
  border_cells: 1,
  marker_pixels: 6,
  box_dims: [32.0, 32.0, 32.0],
};

/** Converts millimeters to meters for kibo-track object-space units. */
export function convertMillimetersToMeters(sizeMillimeters: number): number {
  return sizeMillimeters / MILLIMETERS_PER_METER;
}

/** Parses AprilCube grid string "WxHxD" into tag counts per axis. */
export function parseAprilCubeGridString(
  gridString: string,
): readonly [number, number, number] {
  const gridParts = gridString.split("x").map((part) => Number(part));

  if (gridParts.length !== GRID_DIMENSION_COUNT || gridParts.some((part) => !Number.isInteger(part) || part < 1)) {
    throw new RangeError(`Invalid AprilCube grid string: ${gridString}`);
  }

  return [gridParts[0]!, gridParts[1]!, gridParts[2]!];
}

/** Builds cuboid layout parameters from AprilCube config.json fields. */
export function buildCuboidLayoutFromLayoutJson(
  layoutJson: AprilCubeLayoutJson,
): AprilCubeCuboidLayout {
  return {
    grid: parseAprilCubeGridString(layoutJson.grid),
    tagIds: [...layoutJson.tag_ids],
    tagSizeMeters: convertMillimetersToMeters(layoutJson.tag_size_mm),
    cellSizeMeters: convertMillimetersToMeters(layoutJson.cell_size_mm),
    marginCells: layoutJson.margin_cells,
    borderCells: layoutJson.border_cells,
    markerPixels: layoutJson.marker_pixels,
    boxDimensionsMeters: [
      convertMillimetersToMeters(layoutJson.box_dims[0]),
      convertMillimetersToMeters(layoutJson.box_dims[1]),
      convertMillimetersToMeters(layoutJson.box_dims[2]),
    ],
  };
}

/** Builds AprilCubeConfig from the layout JSON and optional corner order. */
export function buildAprilCubeConfigFromLayoutJson(
  layoutJson: AprilCubeLayoutJson,
  cornerOrder: CornerOrderSelection = "canonical",
): AprilCubeConfig {
  const faceMap: Record<number, AprilCubeFaceName> = {};

  for (const [faceAxisLabel, markerIds] of Object.entries(layoutJson.faces)) {
    const aprilCubeFaceName = FACE_AXIS_TO_APRILCUBE_FACE[faceAxisLabel];

    if (aprilCubeFaceName === undefined) {
      throw new RangeError(`Unsupported face axis label: ${faceAxisLabel}`);
    }

    for (const markerId of markerIds) {
      faceMap[markerId] = aprilCubeFaceName;
    }
  }

  return {
    cubeSize: convertMillimetersToMeters(layoutJson.box_dims[0]),
    faces: faceMap,
    cornerOrder,
    cuboidLayout: buildCuboidLayoutFromLayoutJson(layoutJson),
  };
}
