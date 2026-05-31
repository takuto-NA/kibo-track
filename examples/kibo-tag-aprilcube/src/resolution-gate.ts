/**
 * Resolution consistency gate and camera intrinsics scaling for capture size.
 */
import type { CameraIntrinsics } from "kibo-track";
import type {
  ReferenceCameraIntrinsics,
  ResolutionGateResult,
  ResolutionSnapshot,
} from "./types.js";

export interface ResolutionGateInput {
  readonly videoWidth: number;
  readonly videoHeight: number;
  readonly captureCanvas: HTMLCanvasElement;
  readonly overlayCanvas: HTMLCanvasElement;
  readonly grayscaleBufferLength: number;
  readonly referenceCameraIntrinsics: ReferenceCameraIntrinsics;
}

function buildResolutionSnapshot(input: ResolutionGateInput): ResolutionSnapshot {
  const overlayBoundingRectangle = input.overlayCanvas.getBoundingClientRect();

  return {
    videoWidth: input.videoWidth,
    videoHeight: input.videoHeight,
    captureCanvasWidth: input.captureCanvas.width,
    captureCanvasHeight: input.captureCanvas.height,
    overlayCanvasWidth: input.overlayCanvas.width,
    overlayCanvasHeight: input.overlayCanvas.height,
    overlayCssWidth: overlayBoundingRectangle.width,
    overlayCssHeight: overlayBoundingRectangle.height,
    devicePixelRatio: window.devicePixelRatio,
    grayscaleBufferLength: input.grayscaleBufferLength,
    intrinsicsReferenceWidth: input.referenceCameraIntrinsics.referenceWidth,
    intrinsicsReferenceHeight: input.referenceCameraIntrinsics.referenceHeight,
  };
}

/** Tolerance when comparing reference and capture aspect ratios. */
const REFERENCE_ASPECT_RATIO_TOLERANCE = 0.001;

function referenceAspectRatioMatchesCapture(
  referenceWidth: number,
  referenceHeight: number,
  captureWidth: number,
  captureHeight: number,
): boolean {
  const referenceAspectRatio = referenceWidth / referenceHeight;
  const captureAspectRatio = captureWidth / captureHeight;

  return Math.abs(referenceAspectRatio - captureAspectRatio) <= REFERENCE_ASPECT_RATIO_TOLERANCE;
}

/** Scales reference-resolution intrinsics to the current capture resolution. */
export function scaleCameraIntrinsicsToCaptureResolution(
  referenceCameraIntrinsics: ReferenceCameraIntrinsics,
  captureWidth: number,
  captureHeight: number,
): CameraIntrinsics {
  const scaleX = captureWidth / referenceCameraIntrinsics.referenceWidth;
  const scaleY = captureHeight / referenceCameraIntrinsics.referenceHeight;
  const sourceIntrinsics = referenceCameraIntrinsics.intrinsics;
  const aspectRatioMatches = referenceAspectRatioMatchesCapture(
    referenceCameraIntrinsics.referenceWidth,
    referenceCameraIntrinsics.referenceHeight,
    captureWidth,
    captureHeight,
  );

  if (aspectRatioMatches) {
    return {
      focalLengthX: sourceIntrinsics.focalLengthX * scaleX,
      focalLengthY: sourceIntrinsics.focalLengthY * scaleY,
      principalPointX: sourceIntrinsics.principalPointX * scaleX,
      principalPointY: sourceIntrinsics.principalPointY * scaleY,
    };
  }

  // Guard: capture aspect differs from the calibration reference (mode switch, not a resize).
  // Keep square pixels by scaling both focal lengths with the width ratio.
  return {
    focalLengthX: sourceIntrinsics.focalLengthX * scaleX,
    focalLengthY: sourceIntrinsics.focalLengthY * scaleX,
    principalPointX: sourceIntrinsics.principalPointX * scaleX,
    principalPointY: sourceIntrinsics.principalPointY * scaleY,
  };
}

/** Validates that capture, detector, overlay, and intrinsics coordinate systems match. */
export function validateResolutionConsistency(
  input: ResolutionGateInput,
): ResolutionGateResult {
  if (input.videoWidth <= 0 || input.videoHeight <= 0) {
    return {
      success: false,
      reason: "videoResolutionUnavailable",
      detail: "Video intrinsic width or height is zero.",
    };
  }

  if (
    input.captureCanvas.width !== input.videoWidth ||
    input.captureCanvas.height !== input.videoHeight
  ) {
    return {
      success: false,
      reason: "captureCanvasMismatch",
      detail: `Capture canvas is ${input.captureCanvas.width}x${input.captureCanvas.height}, video is ${input.videoWidth}x${input.videoHeight}.`,
    };
  }

  const expectedGrayscaleLength = input.videoWidth * input.videoHeight;

  if (input.grayscaleBufferLength !== expectedGrayscaleLength) {
    return {
      success: false,
      reason: "detectorDimensionMismatch",
      detail: `Grayscale buffer length ${input.grayscaleBufferLength} does not match ${expectedGrayscaleLength}.`,
    };
  }

  if (
    input.overlayCanvas.width !== input.captureCanvas.width ||
    input.overlayCanvas.height !== input.captureCanvas.height
  ) {
    return {
      success: false,
      reason: "overlayCanvasMismatch",
      detail: `Overlay canvas is ${input.overlayCanvas.width}x${input.overlayCanvas.height}, capture canvas is ${input.captureCanvas.width}x${input.captureCanvas.height}.`,
    };
  }

  const scaledCameraIntrinsics = scaleCameraIntrinsicsToCaptureResolution(
    input.referenceCameraIntrinsics,
    input.videoWidth,
    input.videoHeight,
  );

  return {
    success: true,
    snapshot: buildResolutionSnapshot(input),
    scaledCameraIntrinsics,
    intrinsicsArePlaceholder: input.referenceCameraIntrinsics.isPlaceholder,
  };
}

/** Synchronizes overlay canvas backing store size with capture canvas size. */
export function synchronizeOverlayCanvasSize(
  captureCanvas: HTMLCanvasElement,
  overlayCanvas: HTMLCanvasElement,
): void {
  overlayCanvas.width = captureCanvas.width;
  overlayCanvas.height = captureCanvas.height;
}
