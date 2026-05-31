/**
 * Canvas overlay drawing for marker outlines, cube wireframe, and axes.
 */
import {
  buildFaceObjectCorners,
  projectPoints,
  type CameraIntrinsics,
  type DetectedMarkerCorners,
  type ImagePoint2D,
  type ObjectPoint3D,
  type Pose,
} from "kibo-track";
import {
  AXIS_LENGTH_CUBE_UNITS,
  AXIS_X_COLOR,
  AXIS_Y_COLOR,
  AXIS_Z_COLOR,
  CUBE_WIREFRAME_STROKE_COLOR,
  MARKER_OUTLINE_STROKE_COLOR,
} from "./constants.js";

export interface OverlayDrawInput {
  readonly overlayCanvas: HTMLCanvasElement;
  readonly captureCanvas: HTMLCanvasElement;
  readonly detectedMarkers: ReadonlyArray<DetectedMarkerCorners>;
  readonly pose: Pose | null;
  readonly cubeSizeMeters: number;
  readonly cameraIntrinsics: CameraIntrinsics;
}

const CUBE_EDGE_INDEX_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

/** Builds the eight cube corner vertices centered at the origin. */
export function buildCubeCornerVertices(cubeSizeMeters: number): ObjectPoint3D[] {
  const halfCubeSize = cubeSizeMeters / 2;

  return [
    [-halfCubeSize, -halfCubeSize, halfCubeSize],
    [halfCubeSize, -halfCubeSize, halfCubeSize],
    [halfCubeSize, halfCubeSize, halfCubeSize],
    [-halfCubeSize, halfCubeSize, halfCubeSize],
    [-halfCubeSize, -halfCubeSize, -halfCubeSize],
    [halfCubeSize, -halfCubeSize, -halfCubeSize],
    [halfCubeSize, halfCubeSize, -halfCubeSize],
    [-halfCubeSize, halfCubeSize, -halfCubeSize],
  ];
}

/** Projects cube wireframe edges for overlay validation and drawing. */
export function projectCubeWireframe(
  pose: Pose,
  cubeSizeMeters: number,
  cameraIntrinsics: CameraIntrinsics,
): ImagePoint2D[][] {
  const cubeVertices = buildCubeCornerVertices(cubeSizeMeters);
  const projectedVertices = projectPoints(cubeVertices, pose, cameraIntrinsics);

  return CUBE_EDGE_INDEX_PAIRS.map(([startIndex, endIndex]) => {
    const startPoint = projectedVertices[startIndex];
    const endPoint = projectedVertices[endIndex];

    if (startPoint === undefined || endPoint === undefined) {
      throw new RangeError("Projected cube vertex is missing.");
    }

    return [startPoint, endPoint];
  });
}

function drawMarkerOutlines(
  canvasContext: CanvasRenderingContext2D,
  detectedMarkers: ReadonlyArray<DetectedMarkerCorners>,
): void {
  canvasContext.strokeStyle = MARKER_OUTLINE_STROKE_COLOR;
  canvasContext.lineWidth = 2;
  canvasContext.font = "14px sans-serif";
  canvasContext.fillStyle = MARKER_OUTLINE_STROKE_COLOR;

  for (const marker of detectedMarkers) {
    if (marker.corners.length !== 4) {
      continue;
    }

    canvasContext.beginPath();
    const firstCorner = marker.corners[0];

    if (firstCorner === undefined) {
      continue;
    }

    canvasContext.moveTo(firstCorner[0], firstCorner[1]);

    for (let cornerIndex = 1; cornerIndex < marker.corners.length; cornerIndex += 1) {
      const corner = marker.corners[cornerIndex];

      if (corner === undefined) {
        continue;
      }

      canvasContext.lineTo(corner[0], corner[1]);
    }

    canvasContext.closePath();
    canvasContext.stroke();

    const labelCorner = marker.corners[0];

    if (labelCorner !== undefined) {
      canvasContext.fillText(String(marker.id), labelCorner[0] + 4, labelCorner[1] - 4);
    }
  }
}

function drawProjectedLineSegments(
  canvasContext: CanvasRenderingContext2D,
  lineSegments: ReadonlyArray<ReadonlyArray<ImagePoint2D>>,
  strokeColor: string,
): void {
  canvasContext.strokeStyle = strokeColor;
  canvasContext.lineWidth = 2;

  for (const segment of lineSegments) {
    const startPoint = segment[0];
    const endPoint = segment[1];

    if (startPoint === undefined || endPoint === undefined) {
      continue;
    }

    canvasContext.beginPath();
    canvasContext.moveTo(startPoint[0], startPoint[1]);
    canvasContext.lineTo(endPoint[0], endPoint[1]);
    canvasContext.stroke();
  }
}

function drawPoseAxes(
  canvasContext: CanvasRenderingContext2D,
  pose: Pose,
  cameraIntrinsics: CameraIntrinsics,
): void {
  const origin: ObjectPoint3D = [0, 0, 0];
  const axisX: ObjectPoint3D = [AXIS_LENGTH_CUBE_UNITS, 0, 0];
  const axisY: ObjectPoint3D = [0, AXIS_LENGTH_CUBE_UNITS, 0];
  const axisZ: ObjectPoint3D = [0, 0, AXIS_LENGTH_CUBE_UNITS];
  const projectedAxes = projectPoints([origin, axisX, axisY, axisZ], pose, cameraIntrinsics);
  const projectedOrigin = projectedAxes[0];
  const projectedAxisX = projectedAxes[1];
  const projectedAxisY = projectedAxes[2];
  const projectedAxisZ = projectedAxes[3];

  if (
    projectedOrigin === undefined ||
    projectedAxisX === undefined ||
    projectedAxisY === undefined ||
    projectedAxisZ === undefined
  ) {
    return;
  }

  drawProjectedLineSegments(canvasContext, [[projectedOrigin, projectedAxisX]], AXIS_X_COLOR);
  drawProjectedLineSegments(canvasContext, [[projectedOrigin, projectedAxisY]], AXIS_Y_COLOR);
  drawProjectedLineSegments(canvasContext, [[projectedOrigin, projectedAxisZ]], AXIS_Z_COLOR);
}

/** Draws the current frame, marker outlines, cube wireframe, and pose axes. */
export function drawOverlay(input: OverlayDrawInput): void {
  const canvasContext = input.overlayCanvas.getContext("2d");

  if (canvasContext === null) {
    return;
  }

  canvasContext.clearRect(0, 0, input.overlayCanvas.width, input.overlayCanvas.height);
  canvasContext.drawImage(input.captureCanvas, 0, 0);
  drawMarkerOutlines(canvasContext, input.detectedMarkers);

  if (input.pose === null) {
    return;
  }

  const wireframeSegments = projectCubeWireframe(
    input.pose,
    input.cubeSizeMeters,
    input.cameraIntrinsics,
  );
  drawProjectedLineSegments(canvasContext, wireframeSegments, CUBE_WIREFRAME_STROKE_COLOR);
  drawPoseAxes(canvasContext, input.pose, input.cameraIntrinsics);
}

/** Returns projected front-face corners for synthetic overlay tests. */
export function projectFrontFaceCornersForPose(
  pose: Pose,
  cubeSizeMeters: number,
  cameraIntrinsics: CameraIntrinsics,
): ImagePoint2D[] {
  return projectPoints(buildFaceObjectCorners("front", cubeSizeMeters), pose, cameraIntrinsics);
}
