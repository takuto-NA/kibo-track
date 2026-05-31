/**
 * getUserMedia video constraint builders shared by camera startup and probe paths.
 */
import { buildCameraFacingModeConstraint } from "./camera-facing-mode.js";
import type { CameraResolutionPixels } from "./camera-resolution.js";
import type { CameraFacingModeSelection, CameraFrameRateSelection } from "./types.js";

function parseExplicitFrameRateFromSelection(
  frameRateSelection: CameraFrameRateSelection,
): number | null {
  if (frameRateSelection === "deviceDefault") {
    return null;
  }

  const parsedFrameRate = Number(frameRateSelection);

  if (!Number.isFinite(parsedFrameRate) || parsedFrameRate <= 0) {
    return null;
  }

  return parsedFrameRate;
}

/** Builds optional frameRate constraints from the UI selection. */
export function buildCameraFrameRateConstraint(
  frameRateSelection: CameraFrameRateSelection,
): ConstrainDoubleRange | undefined {
  const targetFrameRate = parseExplicitFrameRateFromSelection(frameRateSelection);

  if (targetFrameRate === null) {
    return undefined;
  }

  return {
    min: targetFrameRate,
    ideal: targetFrameRate,
    max: targetFrameRate,
  };
}

export interface CameraVideoConstraintInput {
  readonly resolution: CameraResolutionPixels;
  readonly frameRateSelection: CameraFrameRateSelection;
  readonly facingModeSelection: CameraFacingModeSelection;
}

/** Builds video track constraints for camera startup. */
export function buildCameraVideoConstraints(
  constraintInput: CameraVideoConstraintInput,
): MediaTrackConstraints {
  const videoConstraints: MediaTrackConstraints = {
    width: { ideal: constraintInput.resolution.widthPixels },
    height: { ideal: constraintInput.resolution.heightPixels },
    facingMode: buildCameraFacingModeConstraint(constraintInput.facingModeSelection),
  };
  const frameRateConstraint = buildCameraFrameRateConstraint(constraintInput.frameRateSelection);

  if (frameRateConstraint !== undefined) {
    videoConstraints.frameRate = frameRateConstraint;
  }

  return videoConstraints;
}

/** Parses an explicit fps value from a UI selection, when present. */
export function readExplicitFrameRateFromSelection(
  frameRateSelection: CameraFrameRateSelection,
): number | null {
  return parseExplicitFrameRateFromSelection(frameRateSelection);
}
