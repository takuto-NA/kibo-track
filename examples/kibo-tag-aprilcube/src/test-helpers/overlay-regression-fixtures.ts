/**
 * Regression fixtures reproducing pre-fix overlay coordinate bugs without git revert.
 */
import type { CameraIntrinsics, ImagePoint2D, Pose } from "kibo-track";
import {
  INTRINSICS_REFERENCE_HEIGHT_PIXELS,
  INTRINSICS_REFERENCE_WIDTH_PIXELS,
  PLACEHOLDER_FOCAL_LENGTH_PIXELS,
  PLACEHOLDER_PRINCIPAL_POINT_X_PIXELS,
  PLACEHOLDER_PRINCIPAL_POINT_Y_PIXELS,
} from "../constants.js";
import { scaleCameraIntrinsicsToCaptureResolution } from "../resolution-gate.js";
import type { ReferenceCameraIntrinsics } from "../types.js";

/** Capture size used in overlay regression scenarios (4:3, differs from 16:9 reference). */
export const OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS = 640;

/** Capture size used in overlay regression scenarios (4:3, differs from 16:9 reference). */
export const OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS = 480;

/** Intentionally mismatched overlay size before synchronizeOverlayCanvasSize runs. */
export const OVERLAY_REGRESSION_DESYNCED_OVERLAY_WIDTH_PIXELS = 320;

/** Intentionally mismatched overlay size before synchronizeOverlayCanvasSize runs. */
export const OVERLAY_REGRESSION_DESYNCED_OVERLAY_HEIGHT_PIXELS = 240;

/** Cube size in meters for overlay projection regression. */
export const OVERLAY_REGRESSION_CUBE_SIZE_METERS = 0.032;

/** Pose fixture: identity rotation, cube centered ahead on +Z. */
export const OVERLAY_REGRESSION_POSE: Pose = {
  rotation: [0, 0, 0, 1],
  translation: [0, 0, 0.25],
};

/** Placeholder reference intrinsics at 1280×720 for regression tests. */
export const OVERLAY_REGRESSION_REFERENCE_CAMERA_INTRINSICS: ReferenceCameraIntrinsics = {
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

const overlayRegressionCaptureScaleX =
  OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS / INTRINSICS_REFERENCE_WIDTH_PIXELS;

const overlayRegressionCaptureScaleY =
  OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS / INTRINSICS_REFERENCE_HEIGHT_PIXELS;

/** Post-fix square-pixel intrinsics at 640×480 (production scaling, single source of truth). */
export const OVERLAY_REGRESSION_FIXED_INTRINSICS_640X480: CameraIntrinsics =
  scaleCameraIntrinsicsToCaptureResolution(
    OVERLAY_REGRESSION_REFERENCE_CAMERA_INTRINSICS,
    OVERLAY_REGRESSION_CAPTURE_WIDTH_PIXELS,
    OVERLAY_REGRESSION_CAPTURE_HEIGHT_PIXELS,
  );

/** Pre-fix anisotropic focal length Y at 640×480 from 1280×720 reference (fy=600 signature). */
export const OVERLAY_REGRESSION_LEGACY_FOCAL_LENGTH_Y_PIXELS =
  PLACEHOLDER_FOCAL_LENGTH_PIXELS * overlayRegressionCaptureScaleY;

/** Pre-fix focal length X at 640×480 from 1280×720 reference (independent scaleX). */
export const OVERLAY_REGRESSION_LEGACY_FOCAL_LENGTH_X_PIXELS =
  PLACEHOLDER_FOCAL_LENGTH_PIXELS * overlayRegressionCaptureScaleX;

/**
 * Legacy bug: always applies independent scaleX/scaleY even when capture aspect
 * differs from the calibration reference (treated resize-only).
 */
export function scaleCameraIntrinsicsLegacyResizeOnly(
  referenceCameraIntrinsics: ReferenceCameraIntrinsics,
  captureWidth: number,
  captureHeight: number,
): CameraIntrinsics {
  const scaleX = captureWidth / referenceCameraIntrinsics.referenceWidth;
  const scaleY = captureHeight / referenceCameraIntrinsics.referenceHeight;
  const sourceIntrinsics = referenceCameraIntrinsics.intrinsics;

  return {
    focalLengthX: sourceIntrinsics.focalLengthX * scaleX,
    focalLengthY: sourceIntrinsics.focalLengthY * scaleY,
    principalPointX: sourceIntrinsics.principalPointX * scaleX,
    principalPointY: sourceIntrinsics.principalPointY * scaleY,
  };
}

/** Mean Euclidean distance between corresponding 2D point pairs. */
export function computeMeanCornerDistancePixels(
  firstCorners: ReadonlyArray<ImagePoint2D>,
  secondCorners: ReadonlyArray<ImagePoint2D>,
): number {
  if (firstCorners.length === 0 || firstCorners.length !== secondCorners.length) {
    return Number.POSITIVE_INFINITY;
  }

  let totalDistancePixels = 0;

  for (let cornerIndex = 0; cornerIndex < firstCorners.length; cornerIndex += 1) {
    const firstCorner = firstCorners[cornerIndex];
    const secondCorner = secondCorners[cornerIndex];

    if (firstCorner === undefined || secondCorner === undefined) {
      return Number.POSITIVE_INFINITY;
    }

    totalDistancePixels += Math.hypot(
      firstCorner[0] - secondCorner[0],
      firstCorner[1] - secondCorner[1],
    );
  }

  return totalDistancePixels / firstCorners.length;
}

/** Vertical span of projected corners (detects anisotropic fy stretch on Y). */
export function computeVerticalSpanPixels(corners: ReadonlyArray<ImagePoint2D>): number {
  if (corners.length === 0) {
    return 0;
  }

  let minimumY = Number.POSITIVE_INFINITY;
  let maximumY = Number.NEGATIVE_INFINITY;

  for (const corner of corners) {
    minimumY = Math.min(minimumY, corner[1]);
    maximumY = Math.max(maximumY, corner[1]);
  }

  return maximumY - minimumY;
}
