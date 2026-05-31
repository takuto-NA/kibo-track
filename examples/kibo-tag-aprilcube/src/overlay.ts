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
import { distortImagePoints } from "./camera-distortion.js";
import {
  AXIS_LENGTH_CUBE_UNITS,
  AXIS_X_COLOR,
  AXIS_Y_COLOR,
  AXIS_Z_COLOR,
  CUBE_WIREFRAME_STROKE_COLOR,
  CUBE_WIREFRAME_STROKE_WIDTH_PX,
  MARKER_OUTLINE_STROKE_COLOR,
  MARKER_OUTLINE_STROKE_WIDTH_PX,
  POSE_AXIS_STROKE_WIDTH_PX,
  WIREFRAME_ONLY_VIEWPORT_BACKGROUND_COLOR,
} from "./constants.js";
import { synchronizeOverlayCanvasSize } from "./resolution-gate.js";
import type { OverlayDisplayMode } from "./types.js";
import {
  DEFAULT_OVERLAY_DISPLAY_MODE,
  readOverlayDisplayModeFromSelectValue,
  shouldShowCameraFeed,
  shouldShowMarkerOutlines,
  shouldShowWireframeOverlay,
  shouldUseOverlayOnlyBackground,
} from "./overlay-display-mode.js";

export interface OverlayDrawInput {
  readonly overlayCanvas: HTMLCanvasElement;
  readonly captureCanvas: HTMLCanvasElement;
  readonly detectedMarkers: ReadonlyArray<DetectedMarkerCorners>;
  readonly pose: Pose | null;
  readonly cubeSizeMeters: number;
  readonly cameraIntrinsics: CameraIntrinsics;
  readonly distortionCoefficients?: readonly number[];
  readonly overlayDisplayMode?: OverlayDisplayMode;
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
  distortionCoefficients?: readonly number[],
): ImagePoint2D[][] {
  const cubeVertices = buildCubeCornerVertices(cubeSizeMeters);
  const projectedVertices = distortImagePoints(
    projectPoints(cubeVertices, pose, cameraIntrinsics),
    cameraIntrinsics,
    distortionCoefficients,
  );

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
  canvasContext.lineWidth = MARKER_OUTLINE_STROKE_WIDTH_PX;

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
  }
}

function drawProjectedLineSegments(
  canvasContext: CanvasRenderingContext2D,
  lineSegments: ReadonlyArray<ReadonlyArray<ImagePoint2D>>,
  strokeColor: string,
  strokeWidthPixels: number,
): void {
  canvasContext.strokeStyle = strokeColor;
  canvasContext.lineWidth = strokeWidthPixels;

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
  distortionCoefficients: readonly number[] | undefined,
  axisStrokeWidthPixels: number,
): void {
  const origin: ObjectPoint3D = [0, 0, 0];
  const axisX: ObjectPoint3D = [AXIS_LENGTH_CUBE_UNITS, 0, 0];
  const axisY: ObjectPoint3D = [0, AXIS_LENGTH_CUBE_UNITS, 0];
  const axisZ: ObjectPoint3D = [0, 0, AXIS_LENGTH_CUBE_UNITS];
  const projectedAxes = distortImagePoints(
    projectPoints([origin, axisX, axisY, axisZ], pose, cameraIntrinsics),
    cameraIntrinsics,
    distortionCoefficients,
  );
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

  drawProjectedLineSegments(
    canvasContext,
    [[projectedOrigin, projectedAxisX]],
    AXIS_X_COLOR,
    axisStrokeWidthPixels,
  );
  drawProjectedLineSegments(
    canvasContext,
    [[projectedOrigin, projectedAxisY]],
    AXIS_Y_COLOR,
    axisStrokeWidthPixels,
  );
  drawProjectedLineSegments(
    canvasContext,
    [[projectedOrigin, projectedAxisZ]],
    AXIS_Z_COLOR,
    axisStrokeWidthPixels,
  );
}

function fillWireframeOnlyBackground(
  canvasContext: CanvasRenderingContext2D,
  overlayCanvas: HTMLCanvasElement,
): void {
  canvasContext.fillStyle = WIREFRAME_ONLY_VIEWPORT_BACKGROUND_COLOR;
  canvasContext.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

/** Draws the current frame, marker outlines, cube wireframe, and pose axes. */
export function drawOverlay(input: OverlayDrawInput): void {
  const canvasContext = input.overlayCanvas.getContext("2d");

  if (canvasContext === null) {
    return;
  }

  const overlayDisplayMode = input.overlayDisplayMode ?? DEFAULT_OVERLAY_DISPLAY_MODE;

  synchronizeOverlayCanvasSize(input.captureCanvas, input.overlayCanvas);

  canvasContext.clearRect(0, 0, input.overlayCanvas.width, input.overlayCanvas.height);

  if (shouldUseOverlayOnlyBackground(overlayDisplayMode)) {
    fillWireframeOnlyBackground(canvasContext, input.overlayCanvas);
  } else if (shouldShowCameraFeed(overlayDisplayMode)) {
    canvasContext.drawImage(
      input.captureCanvas,
      0,
      0,
      input.overlayCanvas.width,
      input.overlayCanvas.height,
    );

    if (shouldShowMarkerOutlines(overlayDisplayMode)) {
      drawMarkerOutlines(canvasContext, input.detectedMarkers);
    }
  }

  if (input.pose === null || !shouldShowWireframeOverlay(overlayDisplayMode)) {
    return;
  }

  const wireframeSegments = projectCubeWireframe(
    input.pose,
    input.cubeSizeMeters,
    input.cameraIntrinsics,
    input.distortionCoefficients,
  );
  drawProjectedLineSegments(
    canvasContext,
    wireframeSegments,
    CUBE_WIREFRAME_STROKE_COLOR,
    CUBE_WIREFRAME_STROKE_WIDTH_PX,
  );
  drawPoseAxes(
    canvasContext,
    input.pose,
    input.cameraIntrinsics,
    input.distortionCoefficients,
    POSE_AXIS_STROKE_WIDTH_PX,
  );
}

/** Returns projected front-face corners for synthetic overlay tests. */
export function projectFrontFaceCornersForPose(
  pose: Pose,
  cubeSizeMeters: number,
  cameraIntrinsics: CameraIntrinsics,
): ImagePoint2D[] {
  return projectPoints(buildFaceObjectCorners("front", cubeSizeMeters), pose, cameraIntrinsics);
}
