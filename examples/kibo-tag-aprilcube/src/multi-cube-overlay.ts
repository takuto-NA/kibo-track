/**
 * Canvas overlay drawing for the 16-cube AprilCube demo: marker outlines, per-cube wireframes, per-cube axes.
 */
import type { CameraIntrinsics, DetectedMarkerCorners, Pose } from "kibo-track";
import { buildMultiCubePalette } from "./multi-cube-color.js";
import { MULTI_CUBE_CONFIG_COUNT } from "./constants.js";
import {
  AXIS_LENGTH_CUBE_UNITS,
  CUBE_WIREFRAME_STROKE_WIDTH_PX,
  MARKER_OUTLINE_STROKE_COLOR,
  MARKER_OUTLINE_STROKE_WIDTH_PX,
  POSE_AXIS_STROKE_WIDTH_PX,
  WIREFRAME_ONLY_VIEWPORT_BACKGROUND_COLOR,
} from "./constants.js";
import { distortImagePoints } from "./camera-distortion.js";
import { projectPoints } from "kibo-track";
import {
  synchronizeOverlayCanvasSize,
} from "./resolution-gate.js";
import {
  shouldShowCameraFeed,
  shouldShowMarkerOutlines,
  shouldShowWireframeOverlay,
  shouldUseOverlayOnlyBackground,
} from "./overlay-display-mode.js";
import {
  buildCuboidCornerVertices,
} from "./overlay.js";
import type { OverlayDisplayMode } from "./types.js";

export interface MultiCubeOverlayDrawInput {
  readonly overlayCanvas: HTMLCanvasElement;
  readonly captureCanvas: HTMLCanvasElement;
  readonly detectedMarkers: ReadonlyArray<DetectedMarkerCorners>;
  readonly cubePoses: ReadonlyArray<Pose | null>;
  readonly boxDimensionsMeters: readonly [number, number, number];
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

    const firstCorner = marker.corners[0];
    if (firstCorner === undefined) {
      continue;
    }

    canvasContext.beginPath();
    canvasContext.moveTo(firstCorner[0], firstCorner[1]);

    for (let i = 1; i < marker.corners.length; i += 1) {
      const corner = marker.corners[i];
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
  lineSegments: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
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

function projectCuboidWireframeSegments(
  pose: Pose,
  boxDimensionsMeters: readonly [number, number, number],
  cameraIntrinsics: CameraIntrinsics,
  distortionCoefficients: readonly number[] | undefined,
): ReadonlyArray<readonly [readonly [number, number], readonly [number, number]]> {
  const cuboidVertices = buildCuboidCornerVertices(boxDimensionsMeters);
  const projectedVertices = distortImagePoints(
    projectPoints(cuboidVertices, pose, cameraIntrinsics),
    cameraIntrinsics,
    distortionCoefficients,
  );

  return CUBE_EDGE_INDEX_PAIRS.map(([startIndex, endIndex]) => {
    const startPoint = projectedVertices[startIndex];
    const endPoint = projectedVertices[endIndex];

    if (startPoint === undefined || endPoint === undefined) {
      throw new RangeError("Projected cuboid vertex is missing.");
    }

    return [startPoint, endPoint] as const;
  });
}

function drawPoseAxes(
  canvasContext: CanvasRenderingContext2D,
  pose: Pose,
  cameraIntrinsics: CameraIntrinsics,
  distortionCoefficients: readonly number[] | undefined,
  axisStrokeWidthPixels: number,
): void {
  const origin: readonly [number, number, number] = [0, 0, 0];
  const axisX: readonly [number, number, number] = [AXIS_LENGTH_CUBE_UNITS, 0, 0];
  const axisY: readonly [number, number, number] = [0, AXIS_LENGTH_CUBE_UNITS, 0];
  const axisZ: readonly [number, number, number] = [0, 0, AXIS_LENGTH_CUBE_UNITS];
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

  // Use the cube color for X/Y/Z so axes are visually bound to their cube.
  // Single-color axes keep the overlay legible when 16 cubes overlap.
  drawProjectedLineSegments(
    canvasContext,
    [[projectedOrigin, projectedAxisX]],
    "#ff4444",
    axisStrokeWidthPixels,
  );
  drawProjectedLineSegments(
    canvasContext,
    [[projectedOrigin, projectedAxisY]],
    "#44ff44",
    axisStrokeWidthPixels,
  );
  drawProjectedLineSegments(
    canvasContext,
    [[projectedOrigin, projectedAxisZ]],
    "#4488ff",
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

/** Draws the multi-cube overlay frame: camera feed, marker outlines, per-cube wireframes, per-cube axes. */
export function drawMultiCubeOverlay(input: MultiCubeOverlayDrawInput): void {
  const canvasContext = input.overlayCanvas.getContext("2d");

  if (canvasContext === null) {
    return;
  }

  const overlayDisplayMode = input.overlayDisplayMode ?? "cameraWithWireframe";

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

  if (!shouldShowWireframeOverlay(overlayDisplayMode)) {
    return;
  }

  if (input.cubePoses.length !== MULTI_CUBE_CONFIG_COUNT) {
    throw new RangeError(
      `Multi-cube overlay expects ${MULTI_CUBE_CONFIG_COUNT} cube poses, received ${input.cubePoses.length}.`,
    );
  }

  const palette = buildMultiCubePalette();

  for (let cubeIndex = 0; cubeIndex < MULTI_CUBE_CONFIG_COUNT; cubeIndex += 1) {
    const pose = input.cubePoses[cubeIndex];
    if (pose === null || pose === undefined) {
      continue;
    }

    const cubeColor = palette[cubeIndex]!;

    const wireframeSegments = projectCuboidWireframeSegments(
      pose,
      input.boxDimensionsMeters,
      input.cameraIntrinsics,
      input.distortionCoefficients,
    );

    drawProjectedLineSegments(
      canvasContext,
      wireframeSegments,
      cubeColor,
      CUBE_WIREFRAME_STROKE_WIDTH_PX,
    );

    drawPoseAxes(
      canvasContext,
      pose,
      input.cameraIntrinsics,
      input.distortionCoefficients,
      POSE_AXIS_STROKE_WIDTH_PX,
    );
  }
}
