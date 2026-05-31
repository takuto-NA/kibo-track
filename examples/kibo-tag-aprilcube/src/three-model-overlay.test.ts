/**
 * Unit tests for three.js model overlay normalization and render decisions.
 */
import { describe, expect, it } from "vitest";
import {
  computeBoundingBoxMaxDimension,
  computeTeapotNormalizationReferenceDimension,
  computeTeapotUniformScaleForCubeSize,
  computeUniformScaleForTargetMaxDimension,
  createNormalizedTeapotGeometry,
  shouldDrawThreeModelOverlay,
  TEAPOT_MODEL_TO_CUBE_SIZE_RATIO,
} from "./three-model-overlay.js";
import {
  OVERLAY_REGRESSION_CUBE_SIZE_METERS,
  OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480,
  OVERLAY_REGRESSION_POSE,
} from "./test-helpers/overlay-regression-fixtures.js";

describe("three model overlay", () => {
  it("computes uniform scale from bounding box max dimension", () => {
    expect(computeUniformScaleForTargetMaxDimension(2, 0.4)).toBeCloseTo(0.2);
    expect(computeBoundingBoxMaxDimension({ sizeX: 1, sizeY: 3, sizeZ: 2 })).toBe(3);
  });

  it("normalizes teapot reference dimension (Y/Z body) to cube size ratio", () => {
    const targetReferenceDimension =
      OVERLAY_REGRESSION_CUBE_SIZE_METERS * TEAPOT_MODEL_TO_CUBE_SIZE_RATIO;
    const normalizedTeapotGeometry = createNormalizedTeapotGeometry(
      OVERLAY_REGRESSION_CUBE_SIZE_METERS,
    );

    normalizedTeapotGeometry.geometry.computeBoundingBox();
    const boundingBox = normalizedTeapotGeometry.geometry.boundingBox;

    // Guard: teapot geometry must expose a bounding box for normalization validation.
    if (boundingBox === null) {
      normalizedTeapotGeometry.geometry.dispose();
      throw new Error("Teapot geometry bounding box is unavailable.");
    }

    const boundingBoxSize = {
      sizeX: boundingBox.max.x - boundingBox.min.x,
      sizeY: boundingBox.max.y - boundingBox.min.y,
      sizeZ: boundingBox.max.z - boundingBox.min.z,
    };
    const referenceDimension = computeTeapotNormalizationReferenceDimension(boundingBoxSize);

    expect(referenceDimension * normalizedTeapotGeometry.uniformScale).toBeCloseTo(
      targetReferenceDimension,
      5,
    );
    normalizedTeapotGeometry.geometry.dispose();
  });

  it("matches computeTeapotUniformScaleForCubeSize with normalized geometry helper", () => {
    const normalizedTeapotGeometry = createNormalizedTeapotGeometry(
      OVERLAY_REGRESSION_CUBE_SIZE_METERS,
    );

    expect(computeTeapotUniformScaleForCubeSize(OVERLAY_REGRESSION_CUBE_SIZE_METERS)).toBeCloseTo(
      normalizedTeapotGeometry.uniformScale,
      8,
    );

    normalizedTeapotGeometry.geometry.dispose();
  });

  it("hides model overlay when pose is unavailable", () => {
    expect(
      shouldDrawThreeModelOverlay({
        overlayDisplayMode: "cameraWithModel",
        cameraFromObjectPose: null,
        cameraIntrinsics: OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480,
        captureCanvas: document.createElement("canvas"),
        cubeSizeMeters: OVERLAY_REGRESSION_CUBE_SIZE_METERS,
      }),
    ).toBe(false);
  });

  it("renders model overlay when pose and intrinsics are available", () => {
    expect(
      shouldDrawThreeModelOverlay({
        overlayDisplayMode: "modelOnly",
        cameraFromObjectPose: OVERLAY_REGRESSION_POSE,
        cameraIntrinsics: OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480,
        captureCanvas: document.createElement("canvas"),
        cubeSizeMeters: OVERLAY_REGRESSION_CUBE_SIZE_METERS,
      }),
    ).toBe(true);
  });
});
