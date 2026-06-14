/**
 * Unit tests for overlay projection helpers.
 */
import { describe, expect, it, vi } from "vitest";
import {
  buildCubeCornerVertices,
  buildCuboidCornerVertices,
  drawOverlay,
  projectCubeWireframe,
  projectCuboidWireframe,
  projectFrontFaceCornersForPose,
} from "./overlay.js";
import { createMockCanvas2dContext } from "./test-helpers/mock-canvas-2d-context.js";
import {
  OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS,
  OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS,
  OVERLAY_REGRESSION_CUBE_SIZE_METERS,
  OVERLAY_REGRESSION_DESYNCED_OVERLAY_HEIGHT_PIXELS,
  OVERLAY_REGRESSION_DESYNCED_OVERLAY_WIDTH_PIXELS,
  OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480,
  OVERLAY_REGRESSION_POSE,
} from "./test-helpers/overlay-regression-fixtures.js";

describe("overlay projection", () => {
  it("builds eight cuboid corner vertices for non-cubic box dimensions", () => {
    const cuboidVertices = buildCuboidCornerVertices([0.04, 0.04, 0.215]);
    expect(cuboidVertices).toHaveLength(8);
    expect(cuboidVertices[0]).toEqual([-0.02, -0.02, 0.1075]);
    expect(cuboidVertices[1]).toEqual([0.02, -0.02, 0.1075]);
  });

  it("projects cuboid wireframe segments from a synthetic pose", () => {
    const cameraIntrinsics = {
      focalLengthX: 900,
      focalLengthY: 900,
      principalPointX: 320,
      principalPointY: 240,
    };
    const pose = {
      rotation: [0, 0, 0, 1] as const,
      translation: [0, 0, 0.5] as const,
    };

    const wireframeSegments = projectCuboidWireframe(
      pose,
      [0.04, 0.04, 0.215],
      cameraIntrinsics,
    );

    expect(wireframeSegments.length).toBeGreaterThan(0);
    expect(wireframeSegments[0]?.length).toBe(2);
  });

  it("builds eight cube corner vertices", () => {
    const cubeVertices = buildCubeCornerVertices(0.032);
    expect(cubeVertices).toHaveLength(8);
  });

  it("projects cube wireframe segments from a synthetic pose", () => {
    const cameraIntrinsics = {
      focalLengthX: 900,
      focalLengthY: 900,
      principalPointX: 320,
      principalPointY: 240,
    };
    const pose = {
      rotation: [0, 0, 0, 1] as const,
      translation: [0, 0, 0.5] as const,
    };

    const wireframeSegments = projectCubeWireframe(pose, 0.032, cameraIntrinsics);

    expect(wireframeSegments.length).toBeGreaterThan(0);
    expect(wireframeSegments[0]?.length).toBe(2);
  });

  it("projects front-face corners for synthetic overlay validation", () => {
    const cameraIntrinsics = {
      focalLengthX: 900,
      focalLengthY: 900,
      principalPointX: 320,
      principalPointY: 240,
    };
    const pose = {
      rotation: [0, 0, 0, 1] as const,
      translation: [0, 0, 0.5] as const,
    };

    const projectedCorners = projectFrontFaceCornersForPose(pose, 0.032, cameraIntrinsics);

    expect(projectedCorners).toHaveLength(4);
    expect(projectedCorners.every((corner) => Number.isFinite(corner[0]))).toBe(true);
  });
});

describe("drawOverlay canvas contract (Root Cause C)", () => {
  it("synchronizes overlay canvas size to capture dimensions before drawing", () => {
    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS;
    captureCanvas.height = OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS;

    const overlayCanvas = document.createElement("canvas");
    overlayCanvas.width = OVERLAY_REGRESSION_DESYNCED_OVERLAY_WIDTH_PIXELS;
    overlayCanvas.height = OVERLAY_REGRESSION_DESYNCED_OVERLAY_HEIGHT_PIXELS;

    const { canvasContext, drawImageMock } = createMockCanvas2dContext();
    vi.spyOn(overlayCanvas, "getContext").mockReturnValue(canvasContext);

    drawOverlay({
      overlayCanvas,
      captureCanvas,
      detectedMarkers: [],
      pose: OVERLAY_REGRESSION_POSE,
      boxDimensionsMeters: [
        OVERLAY_REGRESSION_CUBE_SIZE_METERS,
        OVERLAY_REGRESSION_CUBE_SIZE_METERS,
        OVERLAY_REGRESSION_CUBE_SIZE_METERS,
      ],
      cameraIntrinsics: OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480,
    });

    expect(overlayCanvas.width).toBe(OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS);
    expect(overlayCanvas.height).toBe(OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS);
    expect(drawImageMock).toHaveBeenCalledWith(
      captureCanvas,
      0,
      0,
      OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS,
      OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS,
    );
  });

  it("draws capture frame at full overlay canvas size (explicit destination dimensions)", () => {
    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS;
    captureCanvas.height = OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS;

    const overlayCanvas = document.createElement("canvas");
    overlayCanvas.width = OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS;
    overlayCanvas.height = OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS;

    const { canvasContext, drawImageMock } = createMockCanvas2dContext();
    vi.spyOn(overlayCanvas, "getContext").mockReturnValue(canvasContext);

    drawOverlay({
      overlayCanvas,
      captureCanvas,
      detectedMarkers: [],
      pose: null,
      boxDimensionsMeters: [
        OVERLAY_REGRESSION_CUBE_SIZE_METERS,
        OVERLAY_REGRESSION_CUBE_SIZE_METERS,
        OVERLAY_REGRESSION_CUBE_SIZE_METERS,
      ],
      cameraIntrinsics: OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480,
    });

    expect(drawImageMock).toHaveBeenCalledTimes(1);
    expect(drawImageMock).toHaveBeenCalledWith(
      captureCanvas,
      0,
      0,
      OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS,
      OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS,
    );
  });
});
