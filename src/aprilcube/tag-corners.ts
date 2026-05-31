/**
 * AprilCube cuboid tag corner 3D geometry (AprilCube build_tag_corner_map equivalent).
 */
import type { ObjectPoint3D } from "../core/types.js";
import type { AprilCubeConfig, AprilCubeObjectPointMap } from "./types.js";

/** Axis index for X, Y, Z in 3D coordinates. */
const AXIS_X = 0;
const AXIS_Y = 1;
const AXIS_Z = 2;

/** One AprilCube face definition: name, normal axis/sign, right axis/sign, down axis/sign. */
interface AprilCubeFaceDefinition {
  readonly name: string;
  readonly normalAxis: number;
  readonly normalSign: number;
  readonly rightAxis: number;
  readonly rightSign: number;
  readonly downAxis: number;
  readonly downSign: number;
}

/**
 * Face definitions from AprilCube generate.py FACE_DEFS.
 * cross(right, down) equals outward normal for correct winding.
 */
const APRILCUBE_FACE_DEFINITIONS: readonly AprilCubeFaceDefinition[] = [
  { name: "+X", normalAxis: AXIS_X, normalSign: 1, rightAxis: AXIS_Y, rightSign: -1, downAxis: AXIS_Z, downSign: -1 },
  { name: "-X", normalAxis: AXIS_X, normalSign: -1, rightAxis: AXIS_Y, rightSign: 1, downAxis: AXIS_Z, downSign: -1 },
  { name: "+Y", normalAxis: AXIS_Y, normalSign: 1, rightAxis: AXIS_X, rightSign: 1, downAxis: AXIS_Z, downSign: -1 },
  { name: "-Y", normalAxis: AXIS_Y, normalSign: -1, rightAxis: AXIS_X, rightSign: -1, downAxis: AXIS_Z, downSign: -1 },
  { name: "+Z", normalAxis: AXIS_Z, normalSign: 1, rightAxis: AXIS_X, rightSign: 1, downAxis: AXIS_Y, downSign: 1 },
  { name: "-Z", normalAxis: AXIS_Z, normalSign: -1, rightAxis: AXIS_X, rightSign: 1, downAxis: AXIS_Y, downSign: -1 },
];

function computeAxisCellCount(
  tagCountOnAxis: number,
  markerPixels: number,
  marginCells: number,
  borderCells: number,
): number {
  return 2 * borderCells + tagCountOnAxis * markerPixels + Math.max(0, tagCountOnAxis - 1) * marginCells;
}

function computeFaceLayout(
  grid: readonly [number, number, number],
  axisCellCounts: readonly [number, number, number],
  faceDefinition: AprilCubeFaceDefinition,
): {
  readonly faceRows: number;
  readonly faceColumns: number;
  readonly downCells: number;
  readonly rightCells: number;
} {
  const gridPerAxis = [grid[0], grid[1], grid[2]];
  const cellsPerAxis = [axisCellCounts[0], axisCellCounts[1], axisCellCounts[2]];

  return {
    faceRows: gridPerAxis[faceDefinition.downAxis] ?? 0,
    faceColumns: gridPerAxis[faceDefinition.rightAxis] ?? 0,
    downCells: cellsPerAxis[faceDefinition.downAxis] ?? 0,
    rightCells: cellsPerAxis[faceDefinition.rightAxis] ?? 0,
  };
}

function createPointFromCellCoordinates(
  faceDefinition: AprilCubeFaceDefinition,
  facePositionMeters: number,
  rightHalfMeters: number,
  downHalfMeters: number,
  cellSizeMeters: number,
  rowCells: number,
  columnCells: number,
): ObjectPoint3D {
  const rightCoordinate =
    faceDefinition.rightSign * (-rightHalfMeters + columnCells * cellSizeMeters);
  const downCoordinate =
    faceDefinition.downSign * (-downHalfMeters + rowCells * cellSizeMeters);

  const coordinates: [number, number, number] = [0, 0, 0];
  coordinates[faceDefinition.normalAxis] = facePositionMeters;
  coordinates[faceDefinition.rightAxis] = rightCoordinate;
  coordinates[faceDefinition.downAxis] = downCoordinate;
  return coordinates;
}

/** Builds marker-ID keyed tag corner map from cuboid layout (meters, OpenCV corner order). */
export function buildAprilCubeTagCornerObjectPointMap(
  config: AprilCubeConfig,
): AprilCubeObjectPointMap {
  const cuboidLayout = config.cuboidLayout;

  if (cuboidLayout === undefined) {
    throw new RangeError("cuboidLayout is required for tag corner object point map.");
  }

  const boxHalfMeters: [number, number, number] = [
    cuboidLayout.boxDimensionsMeters[0] / 2,
    cuboidLayout.boxDimensionsMeters[1] / 2,
    cuboidLayout.boxDimensionsMeters[2] / 2,
  ];

  const axisCellCounts: [number, number, number] = [
    computeAxisCellCount(
      cuboidLayout.grid[0],
      cuboidLayout.markerPixels,
      cuboidLayout.marginCells,
      cuboidLayout.borderCells,
    ),
    computeAxisCellCount(
      cuboidLayout.grid[1],
      cuboidLayout.markerPixels,
      cuboidLayout.marginCells,
      cuboidLayout.borderCells,
    ),
    computeAxisCellCount(
      cuboidLayout.grid[2],
      cuboidLayout.markerPixels,
      cuboidLayout.marginCells,
      cuboidLayout.borderCells,
    ),
  ];

  const objectPointMap: Record<number, readonly ObjectPoint3D[]> = {};
  let tagIdCursor = 0;
  const markerPixels = cuboidLayout.markerPixels;
  const cellSizeMeters = cuboidLayout.cellSizeMeters;
  const marginCells = cuboidLayout.marginCells;

  for (const faceDefinition of APRILCUBE_FACE_DEFINITIONS) {
    const faceLayout = computeFaceLayout(cuboidLayout.grid, axisCellCounts, faceDefinition);
    const tagCountOnFace = faceLayout.faceRows * faceLayout.faceColumns;

    const tagBlockWidth =
      faceLayout.faceColumns * markerPixels +
      Math.max(0, faceLayout.faceColumns - 1) * marginCells;
    const tagBlockHeight =
      faceLayout.faceRows * markerPixels +
      Math.max(0, faceLayout.faceRows - 1) * marginCells;
    const rowOffset = Math.floor((faceLayout.downCells - tagBlockHeight) / 2);
    const columnOffset = Math.floor((faceLayout.rightCells - tagBlockWidth) / 2);

    const rightHalfMeters = boxHalfMeters[faceDefinition.rightAxis] ?? 0;
    const downHalfMeters = boxHalfMeters[faceDefinition.downAxis] ?? 0;
    const facePositionMeters =
      faceDefinition.normalSign * (boxHalfMeters[faceDefinition.normalAxis] ?? 0);

    for (let faceRow = 0; faceRow < faceLayout.faceRows; faceRow += 1) {
      for (let faceColumn = 0; faceColumn < faceLayout.faceColumns; faceColumn += 1) {
        const tagIndexOnFace = faceRow * faceLayout.faceColumns + faceColumn;

        if (tagIdCursor + tagIndexOnFace >= cuboidLayout.tagIds.length) {
          break;
        }

        const markerId = cuboidLayout.tagIds[tagIdCursor + tagIndexOnFace];

        if (markerId === undefined) {
          break;
        }

        const rowStartCells =
          rowOffset + faceRow * (markerPixels + marginCells);
        const columnStartCells =
          columnOffset + faceColumn * (markerPixels + marginCells);

        // [TL, TR, BR, BL] with column swap matching AprilCube detect.py.
        const tagCorners: ObjectPoint3D[] = [
          createPointFromCellCoordinates(
            faceDefinition,
            facePositionMeters,
            rightHalfMeters,
            downHalfMeters,
            cellSizeMeters,
            rowStartCells,
            columnStartCells + markerPixels,
          ),
          createPointFromCellCoordinates(
            faceDefinition,
            facePositionMeters,
            rightHalfMeters,
            downHalfMeters,
            cellSizeMeters,
            rowStartCells,
            columnStartCells,
          ),
          createPointFromCellCoordinates(
            faceDefinition,
            facePositionMeters,
            rightHalfMeters,
            downHalfMeters,
            cellSizeMeters,
            rowStartCells + markerPixels,
            columnStartCells,
          ),
          createPointFromCellCoordinates(
            faceDefinition,
            facePositionMeters,
            rightHalfMeters,
            downHalfMeters,
            cellSizeMeters,
            rowStartCells + markerPixels,
            columnStartCells + markerPixels,
          ),
        ];

        objectPointMap[markerId] = tagCorners;
      }
    }

    tagIdCursor += tagCountOnFace;
  }

  return objectPointMap;
}
