/**
 * Unit tests for multi-cube overlay color palette and 16-cube overlay drawing.
 */
import { describe, expect, it, vi } from "vitest";
import { MULTI_CUBE_CONFIG_COUNT } from "./constants.js";
import { buildCubeColor, buildMultiCubePalette } from "./multi-cube-color.js";
import { drawMultiCubeOverlay } from "./multi-cube-overlay.js";
import { createMockCanvas2dContext } from "./test-helpers/mock-canvas-2d-context.js";
import {
  OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS,
  OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS,
  OVERLAY_REGRESSION_CUBE_SIZE_METERS,
  OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480,
  OVERLAY_REGRESSION_POSE,
} from "./test-helpers/overlay-regression-fixtures.js";
import type { Pose } from "kibo-track";

describe("multi-cube color palette", () => {
  it("returns 16 distinct HSL colors in cube-index order", () => {
    const palette = buildMultiCubePalette();

    expect(palette).toHaveLength(MULTI_CUBE_CONFIG_COUNT);
    expect(new Set(palette).size).toBe(MULTI_CUBE_CONFIG_COUNT);

    for (const color of palette) {
      expect(color.startsWith("hsl(")).toBe(true);
    }
  });

  it("throws for out-of-range cube indices", () => {
    expect(() => buildCubeColor(-1)).toThrow(RangeError);
    expect(() => buildCubeColor(MULTI_CUBE_CONFIG_COUNT)).toThrow(RangeError);
  });
});

describe("drawMultiCubeOverlay", () => {
  function buildCubePoses(trackingCount: number): Pose[] {
    const poses: Pose[] = new Array(MULTI_CUBE_CONFIG_COUNT).fill(null);

    for (let i = 0; i < trackingCount; i += 1) {
      poses[i] = {
        rotation: [0, 0, 0, 1],
        translation: [0.05 * i, 0, 0.25],
      };
    }

    return poses;
  }

  it("synchronizes overlay canvas size and draws the capture frame for cameraWithWireframe mode", () => {
    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS;
    captureCanvas.height = OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS;

    const overlayCanvas = document.createElement("canvas");
    overlayCanvas.width = 320;
    overlayCanvas.height = 240;

    const { canvasContext, drawImageMock } = createMockCanvas2dContext();
    vi.spyOn(overlayCanvas, "getContext").mockReturnValue(canvasContext);

    drawMultiCubeOverlay({
      overlayCanvas,
      captureCanvas,
      detectedMarkers: [],
      cubePoses: buildCubePoses(0),
      boxDimensionsMeters: [
        OVERLAY_REGRESSION_CUBE_SIZE_METERS,
        OVERLAY_REGRESSION_CUBE_SIZE_METERS,
        OVERLAY_REGRESSION_CUBE_SIZE_METERS,
      ],
      cameraIntrinsics: OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480,
      overlayDisplayMode: "cameraWithWireframe",
    });

    expect(overlayCanvas.width).toBe(OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS);
    expect(overlayCanvas.height).toBe(OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS);
    expect(drawImageMock).toHaveBeenCalledTimes(1);
  });

  it("strokes wireframe segments for every tracked cube pose", () => {
    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS;
    captureCanvas.height = OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS;

    const overlayCanvas = document.createElement("canvas");
    overlayCanvas.width = OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS;
    overlayCanvas.height = OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS;

    const { canvasContext } = createMockCanvas2dContext();
    const strokeMock = canvasContext.stroke as ReturnType<typeof vi.fn>;
    vi.spyOn(overlayCanvas, "getContext").mockReturnValue(canvasContext);

    drawMultiCubeOverlay({
      overlayCanvas,
      captureCanvas,
      detectedMarkers: [],
      cubePoses: buildCubePoses(MULTI_CUBE_CONFIG_COUNT),
      boxDimensionsMeters: [
        OVERLAY_REGRESSION_CUBE_SIZE_METERS,
        OVERLAY_REGRESSION_CUBE_SIZE_METERS,
        OVERLAY_REGRESSION_CUBE_SIZE_METERS,
      ],
      cameraIntrinsics: OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480,
      overlayDisplayMode: "wireframeOnly",
    });

    // Each cube draws 12 wireframe edges + 3 pose axes = 15 stroke calls.
    expect(strokeMock).toHaveBeenCalledTimes(MULTI_CUBE_CONFIG_COUNT * (12 + 3));
  });

  it("skips wireframe strokes when a cube pose is null", () => {
    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS;
    captureCanvas.height = OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS;

    const overlayCanvas = document.createElement("canvas");
    overlayCanvas.width = OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS;
    overlayCanvas.height = OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS;

    const { canvasContext } = createMockCanvas2dContext();
    const strokeMock = canvasContext.stroke as ReturnType<typeof vi.fn>;
    vi.spyOn(overlayCanvas, "getContext").mockReturnValue(canvasContext);

    drawMultiCubeOverlay({
      overlayCanvas,
      captureCanvas,
      detectedMarkers: [],
      cubePoses: buildCubePoses(1),
      boxDimensionsMeters: [
        OVERLAY_REGRESSION_CUBE_SIZE_METERS,
        OVERLAY_REGRESSION_CUBE_SIZE_METERS,
        OVERLAY_REGRESSION_CUBE_SIZE_METERS,
      ],
      cameraIntrinsics: OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480,
      overlayDisplayMode: "wireframeOnly",
    });

    expect(strokeMock).toHaveBeenCalledTimes(12 + 3);
  });

  it("throws when cubePoses length is not 16", () => {
    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS;
    captureCanvas.height = OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS;

    const overlayCanvas = document.createElement("canvas");
    overlayCanvas.width = OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS;
    overlayCanvas.height = OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS;

    const { canvasContext } = createMockCanvas2dContext();
    vi.spyOn(overlayCanvas, "getContext").mockReturnValue(canvasContext);

    expect(() =>
      drawMultiCubeOverlay({
        overlayCanvas,
        captureCanvas,
        detectedMarkers: [],
        cubePoses: [null, null],
        boxDimensionsMeters: [
          OVERLAY_REGRESSION_CUBE_SIZE_METERS,
          OVERLAY_REGRESSION_CUBE_SIZE_METERS,
          OVERLAY_REGRESSION_CUBE_SIZE_METERS,
        ],
        cameraIntrinsics: OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480,
        overlayDisplayMode: "wireframeOnly",
      }),
    ).toThrow(RangeError);
  });
});
