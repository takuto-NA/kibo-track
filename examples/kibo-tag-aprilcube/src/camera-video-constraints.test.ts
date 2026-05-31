/**
 * Unit tests for shared getUserMedia video constraint builders.
 */
import { describe, expect, it } from "vitest";
import {
  CAMERA_FRAME_RATE_30_FPS,
  INTRINSICS_REFERENCE_HEIGHT_PIXELS,
  INTRINSICS_REFERENCE_WIDTH_PIXELS,
} from "./constants.js";
import {
  buildCameraFrameRateConstraint,
  buildCameraVideoConstraints,
} from "./camera-video-constraints.js";

const REFERENCE_RESOLUTION = {
  widthPixels: INTRINSICS_REFERENCE_WIDTH_PIXELS,
  heightPixels: INTRINSICS_REFERENCE_HEIGHT_PIXELS,
};

describe("camera video constraints", () => {
  it("omits frameRate for device default selection", () => {
    expect(buildCameraFrameRateConstraint("deviceDefault")).toBeUndefined();
    expect(
      buildCameraVideoConstraints({
        resolution: REFERENCE_RESOLUTION,
        frameRateSelection: "deviceDefault",
        facingModeSelection: "environment",
      }).frameRate,
    ).toBeUndefined();
  });

  it("requests an exact 30 fps band when selected", () => {
    expect(buildCameraFrameRateConstraint("30")).toEqual({
      min: CAMERA_FRAME_RATE_30_FPS,
      ideal: CAMERA_FRAME_RATE_30_FPS,
      max: CAMERA_FRAME_RATE_30_FPS,
    });
  });

  it("keeps the requested resolution and facing mode in video constraints", () => {
    const videoConstraints = buildCameraVideoConstraints({
      resolution: { widthPixels: 640, heightPixels: 480 },
      frameRateSelection: "30",
      facingModeSelection: "user",
    });

    expect(videoConstraints.width).toEqual({ ideal: 640 });
    expect(videoConstraints.height).toEqual({ ideal: 480 });
    expect(videoConstraints.facingMode).toBe("user");
  });
});
