/**
 * Opens a camera MediaStream with mobile Safari-friendly facingMode fallbacks.
 */
import {
  buildCameraFacingModeExactConstraint,
  findVideoInputDeviceIdForFacingMode,
  isNegotiatedCameraFacingModeAcceptable,
} from "./camera-facing-mode.js";
import { stopMediaStreamTracks } from "./camera-media-stream-lifecycle.js";
import {
  buildCameraFrameRateConstraint,
  buildCameraVideoConstraints,
} from "./camera-video-constraints.js";
import type { CameraResolutionPixels } from "./camera-resolution.js";
import type { CameraFacingModeSelection, CameraFrameRateSelection } from "./types.js";

export interface CameraMediaStreamRequest {
  readonly resolution: CameraResolutionPixels;
  readonly frameRateSelection: CameraFrameRateSelection;
  readonly facingModeSelection: CameraFacingModeSelection;
}

type CameraMediaStreamAttemptResult =
  | { readonly kind: "success"; readonly mediaStream: MediaStream }
  | { readonly kind: "getUserMediaError"; readonly error: unknown }
  | { readonly kind: "wrongFacingMode" };

function buildCameraMediaStreamAttempts(
  request: CameraMediaStreamRequest,
  videoInputDeviceId: string | null,
): MediaTrackConstraints[] {
  const resolutionAndFacingConstraints = buildCameraVideoConstraints({
    resolution: request.resolution,
    frameRateSelection: "deviceDefault",
    facingModeSelection: request.facingModeSelection,
  });
  const frameRateConstraint = buildCameraFrameRateConstraint(request.frameRateSelection);
  const attempts: MediaTrackConstraints[] = [
    resolutionAndFacingConstraints,
    {
      facingMode: buildCameraFacingModeExactConstraint(request.facingModeSelection),
    },
    {
      facingMode: buildCameraFacingModeExactConstraint(request.facingModeSelection),
      width: { ideal: request.resolution.widthPixels },
      height: { ideal: request.resolution.heightPixels },
    },
  ];

  if (frameRateConstraint !== undefined) {
    attempts.push(
      buildCameraVideoConstraints({
        resolution: request.resolution,
        frameRateSelection: request.frameRateSelection,
        facingModeSelection: request.facingModeSelection,
      }),
    );
    attempts.push({
      ...resolutionAndFacingConstraints,
      frameRate: frameRateConstraint,
    });
  }

  if (videoInputDeviceId !== null) {
    attempts.push({
      deviceId: { exact: videoInputDeviceId },
      width: { ideal: request.resolution.widthPixels },
      height: { ideal: request.resolution.heightPixels },
    });
  }

  return attempts;
}

async function tryOpenCameraMediaStream(
  videoConstraints: MediaTrackConstraints,
  requestedFacingModeSelection: CameraFacingModeSelection,
): Promise<CameraMediaStreamAttemptResult> {
  let mediaStream: MediaStream;

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: false,
    });
  } catch (error) {
    return { kind: "getUserMediaError", error };
  }

  if (!isNegotiatedCameraFacingModeAcceptable(mediaStream, requestedFacingModeSelection)) {
    stopMediaStreamTracks(mediaStream);
    return { kind: "wrongFacingMode" };
  }

  return { kind: "success", mediaStream };
}

async function runCameraMediaStreamAttempts(
  attempts: readonly MediaTrackConstraints[],
  requestedFacingModeSelection: CameraFacingModeSelection,
): Promise<{ mediaStream: MediaStream } | { lastGetUserMediaError: unknown }> {
  let lastGetUserMediaError: unknown = null;

  for (const attemptConstraints of attempts) {
    const attemptResult = await tryOpenCameraMediaStream(
      attemptConstraints,
      requestedFacingModeSelection,
    );

    if (attemptResult.kind === "success") {
      return { mediaStream: attemptResult.mediaStream };
    }

    if (attemptResult.kind === "getUserMediaError") {
      lastGetUserMediaError = attemptResult.error;
    }
  }

  return { lastGetUserMediaError };
}

/**
 * Requests a camera stream and retries with alternate constraints when mobile Safari
 * ignores facingMode or opens the wrong camera.
 */
export async function requestCameraMediaStream(
  request: CameraMediaStreamRequest,
): Promise<MediaStream> {
  if (navigator.mediaDevices === undefined || navigator.mediaDevices.getUserMedia === undefined) {
    throw new Error("navigator.mediaDevices.getUserMedia is unavailable.");
  }

  const enumeratedDevices = await navigator.mediaDevices.enumerateDevices();
  const videoInputDeviceId = findVideoInputDeviceIdForFacingMode(
    enumeratedDevices,
    request.facingModeSelection,
  );
  const initialAttemptResult = await runCameraMediaStreamAttempts(
    buildCameraMediaStreamAttempts(request, videoInputDeviceId),
    request.facingModeSelection,
  );

  if ("mediaStream" in initialAttemptResult) {
    return initialAttemptResult.mediaStream;
  }

  const refreshedDevices = await navigator.mediaDevices.enumerateDevices();
  const refreshedVideoInputDeviceId = findVideoInputDeviceIdForFacingMode(
    refreshedDevices,
    request.facingModeSelection,
  );

  if (
    refreshedVideoInputDeviceId !== null &&
    refreshedVideoInputDeviceId !== videoInputDeviceId
  ) {
    const deviceIdAttemptResult = await runCameraMediaStreamAttempts(
      buildCameraMediaStreamAttempts(request, refreshedVideoInputDeviceId),
      request.facingModeSelection,
    );

    if ("mediaStream" in deviceIdAttemptResult) {
      return deviceIdAttemptResult.mediaStream;
    }

    if (deviceIdAttemptResult.lastGetUserMediaError !== null) {
      throw deviceIdAttemptResult.lastGetUserMediaError;
    }
  }

  if (initialAttemptResult.lastGetUserMediaError !== null) {
    throw initialAttemptResult.lastGetUserMediaError;
  }

  throw new Error(
    `Could not open ${request.facingModeSelection} camera. Try switching Camera to Front, then Back again.`,
  );
}
