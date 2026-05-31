/**
 * Unit tests for resolution consistency gate and intrinsics scaling.
 */
import { describe, expect, it } from "vitest";
import {
  scaleCameraIntrinsicsToCaptureResolution,
  validateResolutionConsistency,
} from "./resolution-gate.js";
import type { ReferenceCameraIntrinsics } from "./types.js";

const referenceCameraIntrinsics: ReferenceCameraIntrinsics = {
  referenceWidth: 1280,
  referenceHeight: 720,
  isPlaceholder: true,
  intrinsics: {
    focalLengthX: 900,
    focalLengthY: 900,
    principalPointX: 640,
    principalPointY: 360,
  },
};

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
