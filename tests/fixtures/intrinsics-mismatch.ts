/**
 * Synthetic camera intrinsics for intrinsics-mismatch regression tests.
 */
import type { CameraIntrinsics } from "../../src/core/types.js";

/** Realistic webcam intrinsics at 1280x720 capture resolution. */
export const TRUE_WEBCAM_INTRINSICS_1280X720: CameraIntrinsics = {
  focalLengthX: 520,
  focalLengthY: 520,
  principalPointX: 640,
  principalPointY: 360,
};

/** Example placeholder intrinsics at 1280x720 (matches example constants). */
export const PLACEHOLDER_INTRINSICS_1280X720: CameraIntrinsics = {
  focalLengthX: 900,
  focalLengthY: 900,
  principalPointX: 640,
  principalPointY: 360,
};

/** Minimum mean wireframe corner error when pose is estimated with wrong intrinsics. */
export const INTRINSICS_MISMATCH_MIN_WIREFRAME_ERROR_PX = 5;

/** Maximum mean wireframe corner error when pose uses matching intrinsics. */
export const INTRINSICS_MATCH_MAX_WIREFRAME_ERROR_PX = 1;
