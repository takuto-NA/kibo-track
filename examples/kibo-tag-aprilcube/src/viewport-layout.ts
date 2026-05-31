/**
 * Viewport layout helpers: keep CSS display aspect ratio aligned with capture pixels.
 */

/** CSS scale factors mapping canvas backing-store pixels to displayed CSS pixels. */
export interface CanvasCssScaleFactors {
  readonly scaleFactorX: number;
  readonly scaleFactorY: number;
}

/** Viewport box dimensions in CSS pixels. */
export interface ViewportBoxDimensions {
  readonly widthPixels: number;
  readonly heightPixels: number;
}

/** Tolerance when comparing CSS scale factors for display uniformity. */
export const CSS_SCALE_FACTOR_UNIFORMITY_TOLERANCE = 0.01;

/** Minimum |scaleX − scaleY| indicating aspect-distorted canvas display (Root Cause A). */
export const CSS_SCALE_FACTOR_NON_UNIFORMITY_MINIMUM_DELTA = 0.1;

/** Viewport aspect ratio for 16:9 (pre-fix bug: fixed regardless of capture). */
export const VIEWPORT_ASPECT_RATIO_16_BY_9 = 16 / 9;

/** Viewport aspect ratio for 640×480 capture (4:3). */
export const VIEWPORT_ASPECT_RATIO_4_BY_3 = 4 / 3;

/** Sets the viewport CSS aspect ratio to match the active capture resolution. */
export function syncViewportCaptureAspectRatio(
  viewportElement: HTMLElement,
  captureWidthPixels: number,
  captureHeightPixels: number,
): void {
  if (captureWidthPixels <= 0 || captureHeightPixels <= 0) {
    return;
  }

  viewportElement.style.aspectRatio = `${captureWidthPixels} / ${captureHeightPixels}`;
}

/** Computes CSS box size from width cap and aspect ratio (width / height). */
export function computeViewportBoxDimensions(
  viewportWidthPixels: number,
  viewportAspectRatio: number,
): ViewportBoxDimensions {
  if (viewportWidthPixels <= 0 || viewportAspectRatio <= 0) {
    return { widthPixels: 0, heightPixels: 0 };
  }

  return {
    widthPixels: viewportWidthPixels,
    heightPixels: viewportWidthPixels / viewportAspectRatio,
  };
}

/** Maps canvas backing-store pixels to CSS display scale factors. */
export function computeCanvasCssScaleFactors(
  canvasWidthPixels: number,
  canvasHeightPixels: number,
  cssWidthPixels: number,
  cssHeightPixels: number,
): CanvasCssScaleFactors {
  if (canvasWidthPixels <= 0 || canvasHeightPixels <= 0) {
    return { scaleFactorX: 0, scaleFactorY: 0 };
  }

  return {
    scaleFactorX: cssWidthPixels / canvasWidthPixels,
    scaleFactorY: cssHeightPixels / canvasHeightPixels,
  };
}

/** Returns true when CSS display scaling is uniform (no aspect distortion). */
export function areCssScaleFactorsUniform(
  scaleFactorX: number,
  scaleFactorY: number,
  tolerance = CSS_SCALE_FACTOR_UNIFORMITY_TOLERANCE,
): boolean {
  return Math.abs(scaleFactorX - scaleFactorY) <= tolerance;
}

/** Computes CSS scale factors when canvas is displayed inside a viewport box. */
export function computeCssScaleFactorsForViewportBox(
  canvasWidthPixels: number,
  canvasHeightPixels: number,
  viewportAspectRatio: number,
  viewportWidthPixels: number,
): CanvasCssScaleFactors {
  const viewportBoxDimensions = computeViewportBoxDimensions(
    viewportWidthPixels,
    viewportAspectRatio,
  );

  return computeCanvasCssScaleFactors(
    canvasWidthPixels,
    canvasHeightPixels,
    viewportBoxDimensions.widthPixels,
    viewportBoxDimensions.heightPixels,
  );
}
