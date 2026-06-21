/**
 * Unit tests for multi-cube 3D overlay visibility predicates.
 */
import { describe, expect, it } from "vitest";
import {
  MULTI_CUBE_MODEL_TO_CUBE_SIZE_RATIO,
  shouldDrawMultiCubeThreeOverlay,
} from "./multi-cube-3d-overlay.js";
import type { CameraIntrinsics, Pose } from "kibo-track";

const SAMPLE_INTRINSICS: CameraIntrinsics = {
  focalLengthX: 900,
  focalLengthY: 900,
  principalPointX: 640,
  principalPointY: 360,
};

const SAMPLE_POSE: Pose = {
  rotation: [0, 0, 0, 1],
  translation: [0, 0, 0.25],
};

describe("MULTI_CUBE_MODEL_TO_CUBE_SIZE_RATIO", () => {
  it("is 2 (64mm max for a 32mm cube)", () => {
    expect(MULTI_CUBE_MODEL_TO_CUBE_SIZE_RATIO).toBe(2);
  });
});

describe("shouldDrawMultiCubeThreeOverlay", () => {
  it("returns false for wireframe-only modes", () => {
    const result = shouldDrawMultiCubeThreeOverlay({
      overlayDisplayMode: "cameraWithWireframe",
      cubePoses: [SAMPLE_POSE],
      cameraIntrinsics: SAMPLE_INTRINSICS,
      captureCanvas: document.createElement("canvas"),
      cubeSizeMeters: 0.032,
    });

    expect(result).toBe(false);
  });

  it("returns false for cameraWithModel when no poses are available", () => {
    const result = shouldDrawMultiCubeThreeOverlay({
      overlayDisplayMode: "cameraWithModel",
      cubePoses: [null, null],
      cameraIntrinsics: SAMPLE_INTRINSICS,
      captureCanvas: document.createElement("canvas"),
      cubeSizeMeters: 0.032,
    });

    expect(result).toBe(false);
  });

  it("returns false for cameraWithModel when intrinsics are missing", () => {
    const result = shouldDrawMultiCubeThreeOverlay({
      overlayDisplayMode: "cameraWithModel",
      cubePoses: [SAMPLE_POSE],
      cameraIntrinsics: null,
      captureCanvas: document.createElement("canvas"),
      cubeSizeMeters: 0.032,
    });

    expect(result).toBe(false);
  });

  it("returns true for cameraWithModel when at least one pose and intrinsics are available", () => {
    const result = shouldDrawMultiCubeThreeOverlay({
      overlayDisplayMode: "cameraWithModel",
      cubePoses: [null, SAMPLE_POSE, null],
      cameraIntrinsics: SAMPLE_INTRINSICS,
      captureCanvas: document.createElement("canvas"),
      cubeSizeMeters: 0.032,
    });

    expect(result).toBe(true);
  });

  it("returns true for modelOnly when at least one pose and intrinsics are available", () => {
    const result = shouldDrawMultiCubeThreeOverlay({
      overlayDisplayMode: "modelOnly",
      cubePoses: [SAMPLE_POSE],
      cameraIntrinsics: SAMPLE_INTRINSICS,
      captureCanvas: document.createElement("canvas"),
      cubeSizeMeters: 0.032,
    });

    expect(result).toBe(true);
  });
});
