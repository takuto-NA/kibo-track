/**
 * Unit tests for OpenCV Brown-Conrady distortion helpers in the example layer.
 */
import { describe, expect, it } from "vitest";
import type { CameraIntrinsics, ImagePoint2D } from "kibo-track";
import {
  distortImagePoint,
  undistortImagePoint,
} from "./camera-distortion.js";

const EXAMPLE_CAMERA_INTRINSICS: CameraIntrinsics = {
  focalLengthX: 2005.8902417296943,
  focalLengthY: 2005.8902417296943,
  principalPointX: 1920,
  principalPointY: 1080,
};

const EXAMPLE_DISTORTION_COEFFICIENTS = [-0.12, 0.03, 0.001, -0.0005, 0.01] as const;

const ROUNDTRIP_TOLERANCE_PX = 0.05;

const SAMPLE_IMAGE_POINTS: readonly ImagePoint2D[] = [
  [1920, 1080],
  [1600, 900],
  [2200, 1300],
  [500, 400],
];

describe("camera distortion helpers", () => {
  it("returns the original point when distortion coefficients are all zero", () => {
    const imagePoint: ImagePoint2D = [1500, 800];
    const zeroDistortionCoefficients = [0, 0, 0, 0, 0];

    expect(
      undistortImagePoint(imagePoint, EXAMPLE_CAMERA_INTRINSICS, zeroDistortionCoefficients),
    ).toEqual(imagePoint);
    expect(
      distortImagePoint(imagePoint, EXAMPLE_CAMERA_INTRINSICS, zeroDistortionCoefficients),
    ).toEqual(imagePoint);
  });

  it("roundtrips undistort then distort back to the original pixel", () => {
    for (const imagePoint of SAMPLE_IMAGE_POINTS) {
      const undistortedPoint = undistortImagePoint(
        imagePoint,
        EXAMPLE_CAMERA_INTRINSICS,
        EXAMPLE_DISTORTION_COEFFICIENTS,
      );
      const roundtrippedPoint = distortImagePoint(
        undistortedPoint,
        EXAMPLE_CAMERA_INTRINSICS,
        EXAMPLE_DISTORTION_COEFFICIENTS,
      );

      expect(Math.hypot(
        roundtrippedPoint[0] - imagePoint[0],
        roundtrippedPoint[1] - imagePoint[1],
      )).toBeLessThan(ROUNDTRIP_TOLERANCE_PX);
    }
  });
});
