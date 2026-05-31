/**
 * Camera startup gate: secure context, mediaDevices, stream, metadata, first frame.
 */
import {
  FIRST_FRAME_CAPTURE_MAX_ATTEMPTS,
  FIRST_FRAME_CAPTURE_RETRY_DELAY_MILLISECONDS,
  VIDEO_METADATA_TIMEOUT_MILLISECONDS,
} from "./constants.js";
import { readNegotiatedCameraFacingMode } from "./camera-facing-mode.js";
import { stopCameraStream, stopMediaStreamTracks } from "./camera-media-stream-lifecycle.js";
import { negotiateCameraFrameRate } from "./camera-frame-rate.js";
import type { CameraResolutionPixels } from "./camera-resolution.js";
import { requestCameraMediaStream } from "./request-camera-media-stream.js";
import type {
  CameraFacingModeSelection,
  CameraFrameRateSelection,
  CameraStartupFailureReason,
  CameraStartupResult,
} from "./types.js";

export interface CameraStartupElements {
  readonly videoElement: HTMLVideoElement;
  readonly captureCanvas: HTMLCanvasElement;
}

export interface CameraStartupOptions {
  readonly frameRateSelection: CameraFrameRateSelection;
  readonly resolution: CameraResolutionPixels;
  readonly facingModeSelection: CameraFacingModeSelection;
}

function readErrorName(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("name" in error)) {
    return null;
  }

  const errorName = error.name;

  if (typeof errorName !== "string") {
    return null;
  }

  return errorName;
}

function mapGetUserMediaError(error: unknown): CameraStartupFailureReason {
  const errorName = readErrorName(error);

  if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
    return "permissionDenied";
  }

  if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
    return "noVideoInput";
  }

  if (errorName === "NotReadableError" || errorName === "TrackStartError") {
    return "deviceBusyOrUnavailable";
  }

  return "deviceBusyOrUnavailable";
}

function waitForVideoMetadata(
  videoElement: HTMLVideoElement,
  timeoutMilliseconds: number,
): Promise<void> {
  if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeoutIdentifier = window.setTimeout(() => {
      videoElement.removeEventListener("loadedmetadata", onMetadataLoaded);
      reject(new Error("Video metadata timed out."));
    }, timeoutMilliseconds);

    function onMetadataLoaded(): void {
      window.clearTimeout(timeoutIdentifier);
      videoElement.removeEventListener("loadedmetadata", onMetadataLoaded);
      resolve();
    }

    videoElement.addEventListener("loadedmetadata", onMetadataLoaded);
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function captureFirstFramePixels(
  videoElement: HTMLVideoElement,
  captureCanvas: HTMLCanvasElement,
): Uint8ClampedArray | null {
  const videoWidth = videoElement.videoWidth;
  const videoHeight = videoElement.videoHeight;

  if (videoWidth <= 0 || videoHeight <= 0) {
    return null;
  }

  captureCanvas.width = videoWidth;
  captureCanvas.height = videoHeight;

  const canvasContext = captureCanvas.getContext("2d", { willReadFrequently: true });

  if (canvasContext === null) {
    return null;
  }

  canvasContext.drawImage(videoElement, 0, 0, videoWidth, videoHeight);
  const imageData = canvasContext.getImageData(0, 0, videoWidth, videoHeight);

  if (imageData.data.length === 0) {
    return null;
  }

  let totalLuminance = 0;

  for (let pixelIndex = 0; pixelIndex < imageData.data.length; pixelIndex += 4) {
    const red = imageData.data[pixelIndex] ?? 0;
    const green = imageData.data[pixelIndex + 1] ?? 0;
    const blue = imageData.data[pixelIndex + 2] ?? 0;
    totalLuminance += red + green + blue;
  }

  if (totalLuminance === 0) {
    return null;
  }

  return imageData.data;
}

async function captureFirstFramePixelsWithRetry(
  videoElement: HTMLVideoElement,
  captureCanvas: HTMLCanvasElement,
): Promise<Uint8ClampedArray | null> {
  for (
    let attemptIndex = 0;
    attemptIndex < FIRST_FRAME_CAPTURE_MAX_ATTEMPTS;
    attemptIndex += 1
  ) {
    const framePixels = captureFirstFramePixels(videoElement, captureCanvas);

    if (framePixels !== null) {
      return framePixels;
    }

    await delay(FIRST_FRAME_CAPTURE_RETRY_DELAY_MILLISECONDS);
  }

  return null;
}

function readCameraLabel(mediaStream: MediaStream): string | null {
  const videoTrack = mediaStream.getVideoTracks()[0];

  if (videoTrack === undefined) {
    return null;
  }

  return videoTrack.label.length > 0 ? videoTrack.label : null;
}

/** Starts the camera and validates that a usable first frame can be captured. */
export async function startCamera(
  elements: CameraStartupElements,
  options: CameraStartupOptions,
): Promise<CameraStartupResult> {
  if (!window.isSecureContext) {
    return {
      success: false,
      reason: "insecureContext",
      detail: "Camera APIs require localhost or HTTPS.",
    };
  }

  if (navigator.mediaDevices === undefined || navigator.mediaDevices.getUserMedia === undefined) {
    return {
      success: false,
      reason: "mediaDevicesUnavailable",
      detail: "navigator.mediaDevices.getUserMedia is unavailable.",
    };
  }

  // requestCameraMediaStream enumerates devices while resolving facingMode fallbacks.
  let mediaStream: MediaStream;

  try {
    mediaStream = await requestCameraMediaStream({
      resolution: options.resolution,
      frameRateSelection: options.frameRateSelection,
      facingModeSelection: options.facingModeSelection,
    });
  } catch (error) {
    return {
      success: false,
      reason: mapGetUserMediaError(error),
      detail: error instanceof Error ? error.message : "getUserMedia failed.",
    };
  }

  elements.videoElement.srcObject = mediaStream;

  try {
    await elements.videoElement.play();
    await waitForVideoMetadata(elements.videoElement, VIDEO_METADATA_TIMEOUT_MILLISECONDS);
  } catch (error) {
    stopMediaStreamTracks(mediaStream);

    return {
      success: false,
      reason: "metadataTimeout",
      detail: error instanceof Error ? error.message : "Video metadata failed.",
    };
  }

  const firstFramePixels = await captureFirstFramePixelsWithRetry(
    elements.videoElement,
    elements.captureCanvas,
  );

  if (firstFramePixels === null) {
    stopMediaStreamTracks(mediaStream);

    return {
      success: false,
      reason: "emptyFrame",
      detail: "First captured frame was empty or all black.",
    };
  }

  const frameRateNegotiation = await negotiateCameraFrameRate(
    mediaStream,
    options.frameRateSelection,
  );

  return {
    success: true,
    mediaStream,
    videoWidth: elements.videoElement.videoWidth,
    videoHeight: elements.videoElement.videoHeight,
    cameraLabel: readCameraLabel(mediaStream),
    requestedFrameRateSelection: options.frameRateSelection,
    requestedResolutionWidthPixels: options.resolution.widthPixels,
    requestedResolutionHeightPixels: options.resolution.heightPixels,
    actualFrameRate: frameRateNegotiation.actualFrameRate,
    capabilityMinFrameRate: frameRateNegotiation.capabilityMinFrameRate,
    capabilityMaxFrameRate: frameRateNegotiation.capabilityMaxFrameRate,
    frameRateMismatch: frameRateNegotiation.frameRateMismatch,
    requestedFacingModeSelection: options.facingModeSelection,
    actualFacingMode: readNegotiatedCameraFacingMode(mediaStream),
  };
}

export { stopCameraStream } from "./camera-media-stream-lifecycle.js";
