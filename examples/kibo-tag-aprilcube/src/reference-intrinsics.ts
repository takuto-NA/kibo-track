/**
 * Placeholder reference camera intrinsics for the browser example.
 */
import {
  INTRINSICS_REFERENCE_HEIGHT_PIXELS,
  INTRINSICS_REFERENCE_WIDTH_PIXELS,
  PLACEHOLDER_FOCAL_LENGTH_PIXELS,
  PLACEHOLDER_PRINCIPAL_POINT_X_PIXELS,
  PLACEHOLDER_PRINCIPAL_POINT_Y_PIXELS,
} from "./constants.js";
import type { ReferenceCameraIntrinsics } from "./types.js";

/** Returns placeholder intrinsics calibrated for the reference resolution. */
export function createPlaceholderReferenceCameraIntrinsics(): ReferenceCameraIntrinsics {
  return {
    referenceWidth: INTRINSICS_REFERENCE_WIDTH_PIXELS,
    referenceHeight: INTRINSICS_REFERENCE_HEIGHT_PIXELS,
    isPlaceholder: true,
    intrinsics: {
      focalLengthX: PLACEHOLDER_FOCAL_LENGTH_PIXELS,
      focalLengthY: PLACEHOLDER_FOCAL_LENGTH_PIXELS,
      principalPointX: PLACEHOLDER_PRINCIPAL_POINT_X_PIXELS,
      principalPointY: PLACEHOLDER_PRINCIPAL_POINT_Y_PIXELS,
    },
  };
}
