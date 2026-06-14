/**
 * Maps the printed AprilCube layout JSON to kibo-track AprilCubeConfig.
 */
import {
  parseAprilCubeCuboidConfigJson,
  type AprilCubeConfig,
  type AprilCubeCuboidLayout,
} from "kibo-track";
import type { AprilCubeLayoutJson, CornerOrderSelection } from "./types.js";

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

export {
  convertMillimetersToMeters,
  parseAprilCubeGridString,
} from "kibo-track";

/** Builds cuboid layout parameters from AprilCube config.json fields. */
export function buildCuboidLayoutFromLayoutJson(
  layoutJson: AprilCubeLayoutJson,
): AprilCubeCuboidLayout {
  const parseResult = parseAprilCubeCuboidConfigJson(layoutJson);

  if (!parseResult.success) {
    throw new Error(
      `Failed to build cuboid layout from layout JSON: ${parseResult.reason} ${parseResult.detail}`,
    );
  }

  const cuboidLayout = parseResult.config.cuboidLayout;

  if (cuboidLayout === undefined) {
    throw new RangeError("Parsed AprilCube layout JSON is missing cuboidLayout.");
  }

  return cuboidLayout;
}

/** Builds AprilCubeConfig from the layout JSON and optional corner order. */
export function buildAprilCubeConfigFromLayoutJson(
  layoutJson: AprilCubeLayoutJson,
  cornerOrder: CornerOrderSelection = "canonical",
): AprilCubeConfig {
  const parseResult = parseAprilCubeCuboidConfigJson(layoutJson, cornerOrder);

  if (!parseResult.success) {
    throw new Error(
      `Failed to build AprilCube config from layout JSON: ${parseResult.reason} ${parseResult.detail}`,
    );
  }

  return parseResult.config;
}
