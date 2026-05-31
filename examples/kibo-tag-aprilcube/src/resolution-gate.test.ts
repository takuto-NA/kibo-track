/**
 * Unit tests for resolution consistency gate and intrinsics scaling.
 */
import { describe, expect, it } from "vitest";
import {
  scaleCameraIntrinsicsToCaptureResolution,
  validateResolutionConsistency,
} from "./resolution-gate.js";
import {
  OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS,
  OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS,
  OVERLAY_REGRESSION_LEGACY_FOCAL_LENGTH_X_PIXELS,
  OVERLAY_REGRESSION_LEGACY_FOCAL_LENGTH_Y_PIXELS,
  OVERLAY_REGRESSION_REFERENCE_CAMERA_INTRINSICS,
  scaleCameraIntrinsicsLegacyResizeOnly,
} from "./test-helpers/overlay-regression-fixtures.js";
import type { ReferenceCameraIntrinsics } from "./types.js";

const referenceCameraIntrinsics: ReferenceCameraIntrinsics =
  OVERLAY_REGRESSION_REFERENCE_CAMERA_INTRINSICS;

describe("scaleCameraIntrinsicsToCaptureResolution", () => {
  it("scales intrinsics to the capture resolution", () => {
    const scaledIntrinsics = scaleCameraIntrinsicsToCaptureResolution(
      referenceCameraIntrinsics,
      640,
      360,
    );

    expect(scaledIntrinsics.focalLengthX).toBeCloseTo(450);
    expect(scaledIntrinsics.focalLengthY).toBeCloseTo(450);
    expect(scaledIntrinsics.principalPointX).toBeCloseTo(320);
    expect(scaledIntrinsics.principalPointY).toBeCloseTo(180);
  });

  it("scales calibrated intrinsics from calibration resolution to capture resolution", () => {
    const calibratedReferenceIntrinsics: ReferenceCameraIntrinsics = {
      referenceWidth: 1280,
      referenceHeight: 720,
      isPlaceholder: false,
      intrinsics: {
        focalLengthX: 700,
        focalLengthY: 700,
        principalPointX: 640,
        principalPointY: 360,
      },
    };

    const scaledIntrinsics = scaleCameraIntrinsicsToCaptureResolution(
      calibratedReferenceIntrinsics,
      640,
      480,
    );

    expect(scaledIntrinsics.focalLengthX).toBeCloseTo(350);
    expect(scaledIntrinsics.focalLengthY).toBeCloseTo(350);
    expect(scaledIntrinsics.principalPointX).toBeCloseTo(320);
    expect(scaledIntrinsics.principalPointY).toBeCloseTo(240);
  });

  it("keeps square pixels when capture aspect differs from the calibration reference", () => {
    const scaledIntrinsics = scaleCameraIntrinsicsToCaptureResolution(
      referenceCameraIntrinsics,
      OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS,
      OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS,
    );

    expect(scaledIntrinsics.focalLengthX).toBeCloseTo(450);
    expect(scaledIntrinsics.focalLengthY).toBeCloseTo(450);
    expect(scaledIntrinsics.focalLengthX).toBe(scaledIntrinsics.focalLengthY);
  });

  it("regression: reproduces legacy anisotropic fy=600 at 640x480 from 1280x720 ref", () => {
    const legacyIntrinsics = scaleCameraIntrinsicsLegacyResizeOnly(
      referenceCameraIntrinsics,
      OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS,
      OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS,
    );

    expect(legacyIntrinsics.focalLengthX).toBeCloseTo(OVERLAY_REGRESSION_LEGACY_FOCAL_LENGTH_X_PIXELS);
    expect(legacyIntrinsics.focalLengthY).toBeCloseTo(OVERLAY_REGRESSION_LEGACY_FOCAL_LENGTH_Y_PIXELS);
    expect(OVERLAY_REGRESSION_LEGACY_FOCAL_LENGTH_Y_PIXELS).toBeCloseTo(600);
  });

  // Revert guard (T5): swapping production scaling for scaleCameraIntrinsicsLegacyResizeOnly fails here.
  it("regression: current scaling must not match legacy anisotropic fy at aspect mismatch", () => {
    const scaledIntrinsics = scaleCameraIntrinsicsToCaptureResolution(
      referenceCameraIntrinsics,
      OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS,
      OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS,
    );
    const legacyIntrinsics = scaleCameraIntrinsicsLegacyResizeOnly(
      referenceCameraIntrinsics,
      OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS,
      OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS,
    );

    expect(scaledIntrinsics.focalLengthY).not.toBeCloseTo(legacyIntrinsics.focalLengthY);
    expect(scaledIntrinsics.focalLengthY).toBe(scaledIntrinsics.focalLengthX);
  });
});

describe("validateResolutionConsistency", () => {
  it("accepts matching video, capture, overlay, and grayscale dimensions", () => {
    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = 640;
    captureCanvas.height = 480;

    const overlayCanvas = document.createElement("canvas");
    overlayCanvas.width = 640;
    overlayCanvas.height = 480;

    const result = validateResolutionConsistency({
      videoWidth: 640,
      videoHeight: 480,
      captureCanvas,
      overlayCanvas,
      grayscaleBufferLength: 640 * 480,
      referenceCameraIntrinsics,
    });

    expect(result.success).toBe(true);
  });

  it("returns captureCanvasMismatch when canvas size differs from video size", () => {
    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = 320;
    captureCanvas.height = 240;

    const overlayCanvas = document.createElement("canvas");
    overlayCanvas.width = 320;
    overlayCanvas.height = 240;

    const result = validateResolutionConsistency({
      videoWidth: 640,
      videoHeight: 480,
      captureCanvas,
      overlayCanvas,
      grayscaleBufferLength: 320 * 240,
      referenceCameraIntrinsics,
    });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.reason).toBe("captureCanvasMismatch");
  });

  it("returns detectorDimensionMismatch when grayscale length is wrong", () => {
    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = 640;
    captureCanvas.height = 480;

    const overlayCanvas = document.createElement("canvas");
    overlayCanvas.width = 640;
    overlayCanvas.height = 480;

    const result = validateResolutionConsistency({
      videoWidth: 640,
      videoHeight: 480,
      captureCanvas,
      overlayCanvas,
      grayscaleBufferLength: 100,
      referenceCameraIntrinsics,
    });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.reason).toBe("detectorDimensionMismatch");
  });
});
