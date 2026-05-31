/**
 * Unit tests for viewport layout helpers.
 */
import { describe, expect, it } from "vitest";
import { VIEWPORT_MAX_WIDTH_PIXELS } from "./constants.js";
import {
  OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS,
  OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS,
} from "./test-helpers/overlay-regression-fixtures.js";
import {
  areCssScaleFactorsUniform,
  computeCanvasCssScaleFactors,
  computeCssScaleFactorsForViewportBox,
  computeViewportBoxDimensions,
  CSS_SCALE_FACTOR_NON_UNIFORMITY_MINIMUM_DELTA,
  CSS_SCALE_FACTOR_UNIFORMITY_TOLERANCE,
  syncViewportCaptureAspectRatio,
  VIEWPORT_ASPECT_RATIO_16_BY_9,
  VIEWPORT_ASPECT_RATIO_4_BY_3,
} from "./viewport-layout.js";

describe("syncViewportCaptureAspectRatio", () => {
  it("sets the viewport aspect ratio from capture dimensions", () => {
    const viewportElement = document.createElement("section");

    syncViewportCaptureAspectRatio(viewportElement, 640, 480);

    expect(viewportElement.style.aspectRatio).toBe("640 / 480");
  });

  it("ignores non-positive capture dimensions", () => {
    const viewportElement = document.createElement("section");
    viewportElement.style.aspectRatio = "1280 / 720";

    syncViewportCaptureAspectRatio(viewportElement, 0, 480);

    expect(viewportElement.style.aspectRatio).toBe("1280 / 720");
  });
});

describe("computeViewportBoxDimensions", () => {
  it("derives height from width and aspect ratio", () => {
    const viewportBoxDimensions = computeViewportBoxDimensions(
      VIEWPORT_MAX_WIDTH_PIXELS,
      VIEWPORT_ASPECT_RATIO_16_BY_9,
    );

    expect(viewportBoxDimensions.widthPixels).toBe(VIEWPORT_MAX_WIDTH_PIXELS);
    // Log session reference (rounded): ~538px at width ~958 for 16:9.
    expect(viewportBoxDimensions.heightPixels).toBeCloseTo(
      VIEWPORT_MAX_WIDTH_PIXELS / VIEWPORT_ASPECT_RATIO_16_BY_9,
    );
  });
});

describe("overlay display regression (Root Cause A)", () => {
  it("regression: 640x480 canvas in 16:9 viewport box has non-uniform CSS scale", () => {
    // Pre-fix log reference: cssScale 1.497 / 1.121 at ~958×538 for 640×480 canvas.
    const scaleFactors = computeCssScaleFactorsForViewportBox(
      OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS,
      OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS,
      VIEWPORT_ASPECT_RATIO_16_BY_9,
      VIEWPORT_MAX_WIDTH_PIXELS,
    );

    expect(areCssScaleFactorsUniform(
      scaleFactors.scaleFactorX,
      scaleFactors.scaleFactorY,
      CSS_SCALE_FACTOR_UNIFORMITY_TOLERANCE,
    )).toBe(false);
    expect(Math.abs(scaleFactors.scaleFactorX - scaleFactors.scaleFactorY)).toBeGreaterThan(
      CSS_SCALE_FACTOR_NON_UNIFORMITY_MINIMUM_DELTA,
    );
  });

  it("regression: 640x480 canvas in matched 4:3 viewport box has uniform CSS scale", () => {
    // Post-fix log reference: cssScale ~1.497 / 1.496 at ~958×718 for 640×480 canvas.
    const matchedViewportBox = computeViewportBoxDimensions(
      VIEWPORT_MAX_WIDTH_PIXELS,
      VIEWPORT_ASPECT_RATIO_4_BY_3,
    );
    const scaleFactors = computeCanvasCssScaleFactors(
      OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS,
      OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS,
      matchedViewportBox.widthPixels,
      matchedViewportBox.heightPixels,
    );

    expect(areCssScaleFactorsUniform(
      scaleFactors.scaleFactorX,
      scaleFactors.scaleFactorY,
      CSS_SCALE_FACTOR_UNIFORMITY_TOLERANCE,
    )).toBe(true);
    expect(matchedViewportBox.heightPixels).toBeCloseTo(
      VIEWPORT_MAX_WIDTH_PIXELS / VIEWPORT_ASPECT_RATIO_4_BY_3,
    );
  });

  it("regression: 1280x720 canvas in matched 16:9 viewport box has uniform CSS scale", () => {
    const matchedViewportBox = computeViewportBoxDimensions(
      VIEWPORT_MAX_WIDTH_PIXELS,
      VIEWPORT_ASPECT_RATIO_16_BY_9,
    );
    const scaleFactors = computeCanvasCssScaleFactors(
      1280,
      720,
      matchedViewportBox.widthPixels,
      matchedViewportBox.heightPixels,
    );

    expect(areCssScaleFactorsUniform(
      scaleFactors.scaleFactorX,
      scaleFactors.scaleFactorY,
      CSS_SCALE_FACTOR_UNIFORMITY_TOLERANCE,
    )).toBe(true);
  });
});
