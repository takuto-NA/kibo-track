/**
 * Unit tests for three.js overlay model normalization helpers.
 */
import { describe, expect, it } from "vitest";
import {
  BODY60_OBJ_BOUNDING_BOX_SIZE_MILLIMETERS,
  computeBoundingBoxMaxDimension,
  computeNormalizedModelScaleForCubeSize,
  computeUniformScaleForTargetMaxDimension,
  convertBoundingBoxSizeMillimetersToMeters,
  THREE_OVERLAY_MODEL_TO_CUBE_SIZE_RATIO,
} from "./three-model-normalization.js";
import { OVERLAY_REGRESSION_CUBE_SIZE_METERS } from "./test-helpers/overlay-regression-fixtures.js";

describe("three model normalization", () => {
  it("computes uniform scale from bounding box max dimension", () => {
    expect(computeUniformScaleForTargetMaxDimension(2, 0.4)).toBeCloseTo(0.2);
    expect(computeBoundingBoxMaxDimension({ sizeX: 1, sizeY: 3, sizeZ: 2 })).toBe(3);
  });

  it("normalizes ボディ60.obj bbox to the AprilCube target ratio in meters", () => {
    const boundingBoxSizeMeters = convertBoundingBoxSizeMillimetersToMeters(
      BODY60_OBJ_BOUNDING_BOX_SIZE_MILLIMETERS,
    );
    const normalizedModelScale = computeNormalizedModelScaleForCubeSize(
      boundingBoxSizeMeters,
      OVERLAY_REGRESSION_CUBE_SIZE_METERS,
    );

    expect(normalizedModelScale.referenceDimensionMeters * normalizedModelScale.uniformScale).toBeCloseTo(
      OVERLAY_REGRESSION_CUBE_SIZE_METERS * THREE_OVERLAY_MODEL_TO_CUBE_SIZE_RATIO,
      5,
    );
  });
});
