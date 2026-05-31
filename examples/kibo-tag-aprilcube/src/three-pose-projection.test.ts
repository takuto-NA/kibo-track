/**
 * Regression tests for three.js pose/projection alignment with kibo-track pinhole math.
 */
import { describe, expect, it } from "vitest";
import {
  OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS,
  OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS,
  OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480,
  OVERLAY_REGRESSION_POSE,
} from "./test-helpers/overlay-regression-fixtures.js";
import {
  computeWebGlCanvasPixelSize,
  projectObjectOriginToPixelViaKiboTrack,
  projectObjectOriginToPixelViaThreeJsPipeline,
} from "./three-pose-projection.js";

describe("three pose projection baseline", () => {
  it("matches kibo-track object-origin projection at 640x480", () => {
    const kiboTrackProjection = projectObjectOriginToPixelViaKiboTrack(
      OVERLAY_REGRESSION_POSE,
      OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480,
    );
    const threeJsProjection = projectObjectOriginToPixelViaThreeJsPipeline({
      cameraFromObjectPose: OVERLAY_REGRESSION_POSE,
      cameraIntrinsics: OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480,
      imageWidthPixels: OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS,
      imageHeightPixels: OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS,
    });

    expect(threeJsProjection[0]).toBeCloseTo(kiboTrackProjection[0]!, 4);
    expect(threeJsProjection[1]).toBeCloseTo(kiboTrackProjection[1]!, 4);
  });

  it("centers identity pose translation on the principal point", () => {
    const projectedOrigin = projectObjectOriginToPixelViaKiboTrack(
      OVERLAY_REGRESSION_POSE,
      OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480,
    );

    expect(projectedOrigin[0]).toBeCloseTo(
      OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480.principalPointX,
      4,
    );
    expect(projectedOrigin[1]).toBeCloseTo(
      OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480.principalPointY,
      4,
    );
  });

  it("computes WebGL canvas backing-store size from CSS size and DPR", () => {
    expect(computeWebGlCanvasPixelSize(640, 480, 2)).toEqual({
      widthPixels: 1280,
      heightPixels: 960,
      devicePixelRatio: 2,
    });
  });
});
