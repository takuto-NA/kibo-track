/**
 * Camera frame-rate selection helpers for getUserMedia constraints.
 */
import { CAMERA_FRAME_RATE_CANDIDATE_VALUES } from "./constants.js";
import type { CameraResolutionPixels } from "./camera-resolution.js";
import { formatCameraResolutionLabel } from "./camera-resolution.js";
import type { CameraFrameRateSelection } from "./types.js";

/** Tolerance when comparing requested and negotiated frame rates (fps). */
const FRAME_RATE_MATCH_TOLERANCE_FPS = 0.5;

export interface CameraFrameRateNegotiationResult {
  readonly actualFrameRate: number | null;
  readonly capabilityMinFrameRate: number | null;
  readonly capabilityMaxFrameRate: number | null;
  readonly frameRateMismatch: boolean;
}

export interface CameraFrameRateProbeResult {
  readonly success: boolean;
  readonly capabilityMinFrameRate: number | null;
  readonly capabilityMaxFrameRate: number | null;
  readonly supportedCandidateFrameRates: readonly number[];
  readonly detail: string;
}

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

function frameRatesMatch(requestedFrameRate: number, actualFrameRate: number): boolean {
  return Math.abs(requestedFrameRate - actualFrameRate) <= FRAME_RATE_MATCH_TOLERANCE_FPS;
}

function readVideoTrackFrameRateCapabilities(
  videoTrack: MediaStreamTrack,
): readonly [number | null, number | null] {
  const capabilities = videoTrack.getCapabilities?.().frameRate;

  if (capabilities === undefined) {
    return [null, null];
  }

  const capabilityMinFrameRate =
    capabilities.min !== undefined && Number.isFinite(capabilities.min) ? capabilities.min : null;
  const capabilityMaxFrameRate =
    capabilities.max !== undefined && Number.isFinite(capabilities.max) ? capabilities.max : null;

  return [capabilityMinFrameRate, capabilityMaxFrameRate];
}

function stopMediaStreamTracks(mediaStream: MediaStream): void {
  for (const track of mediaStream.getTracks()) {
    track.stop();
  }
}

/** Filters candidate fps values that fit within a probed capability range. */
export function filterSupportedCameraFrameRateCandidates(
  capabilityMinFrameRate: number | null,
  capabilityMaxFrameRate: number | null,
  candidateFrameRates: readonly number[] = CAMERA_FRAME_RATE_CANDIDATE_VALUES,
): readonly number[] {
  if (capabilityMinFrameRate === null && capabilityMaxFrameRate === null) {
    return candidateFrameRates;
  }

  return candidateFrameRates.filter((candidateFrameRate) => {
    if (
      capabilityMinFrameRate !== null &&
      candidateFrameRate < capabilityMinFrameRate - FRAME_RATE_MATCH_TOLERANCE_FPS
    ) {
      return false;
    }

    if (
      capabilityMaxFrameRate !== null &&
      candidateFrameRate > capabilityMaxFrameRate + FRAME_RATE_MATCH_TOLERANCE_FPS
    ) {
      return false;
    }

    return true;
  });
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
}

/** Builds video track constraints for camera startup. */
export function buildCameraVideoConstraints(
  constraintInput: CameraVideoConstraintInput,
): MediaTrackConstraints {
  const videoConstraints: MediaTrackConstraints = {
    width: { ideal: constraintInput.resolution.widthPixels },
    height: { ideal: constraintInput.resolution.heightPixels },
  };
  const frameRateConstraint = buildCameraFrameRateConstraint(constraintInput.frameRateSelection);

  if (frameRateConstraint !== undefined) {
    videoConstraints.frameRate = frameRateConstraint;
  }

  return videoConstraints;
}

/** Reads the selected frame-rate option from the controls UI. */
export function readSelectedCameraFrameRateSelection(
  cameraFrameRateSelect: HTMLSelectElement,
): CameraFrameRateSelection {
  const selectedValue = cameraFrameRateSelect.value;

  if (selectedValue === "deviceDefault") {
    return "deviceDefault";
  }

  if (parseExplicitFrameRateFromSelection(selectedValue as CameraFrameRateSelection) !== null) {
    return selectedValue as CameraFrameRateSelection;
  }

  return "deviceDefault";
}

/** Populates the fps select with device-default plus all common candidates (no camera probe). */
export function renderDefaultCameraFrameRateSelectOptions(
  cameraFrameRateSelect: HTMLSelectElement,
): void {
  renderCameraFrameRateSelectOptions(
    cameraFrameRateSelect,
    [...CAMERA_FRAME_RATE_CANDIDATE_VALUES],
  );
}

/** Populates the fps select with device-default plus probed supported candidates. */
export function renderCameraFrameRateSelectOptions(
  cameraFrameRateSelect: HTMLSelectElement,
  supportedCandidateFrameRates: readonly number[],
): void {
  const previousSelection = cameraFrameRateSelect.value;

  cameraFrameRateSelect.replaceChildren();

  const deviceDefaultOption = document.createElement("option");
  deviceDefaultOption.value = "deviceDefault";
  deviceDefaultOption.textContent = "Device default";
  cameraFrameRateSelect.appendChild(deviceDefaultOption);

  for (const candidateFrameRate of supportedCandidateFrameRates) {
    const frameRateOption = document.createElement("option");
    frameRateOption.value = String(candidateFrameRate);
    frameRateOption.textContent = String(candidateFrameRate);
    cameraFrameRateSelect.appendChild(frameRateOption);
  }

  const validSelectionValues = new Set([
    "deviceDefault",
    ...supportedCandidateFrameRates.map((candidateFrameRate) => String(candidateFrameRate)),
  ]);

  cameraFrameRateSelect.value = validSelectionValues.has(previousSelection)
    ? previousSelection
    : "deviceDefault";
}

/** Formats a short hint describing probed fps capabilities at a capture resolution. */
export function formatCameraFrameRateProbeMessage(
  probeResult: CameraFrameRateProbeResult,
  resolution: CameraResolutionPixels,
): string {
  if (!probeResult.success) {
    return probeResult.detail;
  }

  const capabilityRangeMessage = formatFrameRateCapabilityRangeMessage(
    probeResult.capabilityMinFrameRate,
    probeResult.capabilityMaxFrameRate,
  );
  const supportedOptionsMessage =
    probeResult.supportedCandidateFrameRates.length > 0
      ? probeResult.supportedCandidateFrameRates.join(", ")
      : "none within the probed range";

  return `At ${formatCameraResolutionLabel(resolution)}: device reports ${capabilityRangeMessage}; selectable: ${supportedOptionsMessage} fps`;
}

function formatFrameRateCapabilityRangeMessage(
  capabilityMinFrameRate: number | null,
  capabilityMaxFrameRate: number | null,
): string {
  if (capabilityMinFrameRate === null && capabilityMaxFrameRate === null) {
    return "unknown range";
  }

  return `${capabilityMinFrameRate ?? "?"}–${capabilityMaxFrameRate ?? "?"} fps`;
}

/** Reads frame-rate capability from an already-open camera stream (no extra getUserMedia). */
export function buildFrameRateProbeResultFromMediaStream(
  mediaStream: MediaStream,
  resolution: CameraResolutionPixels,
): CameraFrameRateProbeResult {
  const videoTrack = mediaStream.getVideoTracks()[0];

  if (videoTrack === undefined) {
    return {
      success: false,
      capabilityMinFrameRate: null,
      capabilityMaxFrameRate: null,
      supportedCandidateFrameRates: [],
      detail: "Could not read frame rates: no video track on the active stream.",
    };
  }

  const [capabilityMinFrameRate, capabilityMaxFrameRate] =
    readVideoTrackFrameRateCapabilities(videoTrack);
  const supportedCandidateFrameRates = filterSupportedCameraFrameRateCandidates(
    capabilityMinFrameRate,
    capabilityMaxFrameRate,
  );
  const probeResult: CameraFrameRateProbeResult = {
    success: true,
    capabilityMinFrameRate,
    capabilityMaxFrameRate,
    supportedCandidateFrameRates,
    detail: "",
  };

  return {
    ...probeResult,
    detail: formatCameraFrameRateProbeMessage(probeResult, resolution),
  };
}

/**
 * Opens a brief camera stream at the requested resolution and reads frameRate capabilities.
 * Browsers expose only a min/max range, not a discrete list; candidates are filtered from that range.
 */
export async function probeCameraFrameRateOptions(
  resolution: CameraResolutionPixels,
): Promise<CameraFrameRateProbeResult> {
  if (!window.isSecureContext) {
    return {
      success: false,
      capabilityMinFrameRate: null,
      capabilityMaxFrameRate: null,
      supportedCandidateFrameRates: [],
      detail: "Camera APIs require localhost or HTTPS to probe frame rates.",
    };
  }

  if (navigator.mediaDevices === undefined || navigator.mediaDevices.getUserMedia === undefined) {
    return {
      success: false,
      capabilityMinFrameRate: null,
      capabilityMaxFrameRate: null,
      supportedCandidateFrameRates: [],
      detail: "Camera APIs are unavailable in this browser.",
    };
  }

  let mediaStream: MediaStream;

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: resolution.widthPixels },
        height: { ideal: resolution.heightPixels },
      },
      audio: false,
    });
  } catch (error) {
    const detailMessage = error instanceof Error ? error.message : "Camera permission denied.";

    return {
      success: false,
      capabilityMinFrameRate: null,
      capabilityMaxFrameRate: null,
      supportedCandidateFrameRates: [],
      detail: `Could not probe frame rates: ${detailMessage}`,
    };
  }

  const videoTrack = mediaStream.getVideoTracks()[0];

  if (videoTrack === undefined) {
    stopMediaStreamTracks(mediaStream);

    return {
      success: false,
      capabilityMinFrameRate: null,
      capabilityMaxFrameRate: null,
      supportedCandidateFrameRates: [],
      detail: "Could not probe frame rates: no video track returned.",
    };
  }

  const probeResult = buildFrameRateProbeResultFromMediaStream(mediaStream, resolution);

  stopMediaStreamTracks(mediaStream);

  return probeResult;
}

/** Returns the negotiated frame rate from an active video track, if reported. */
export function readVideoTrackFrameRate(mediaStream: MediaStream | null): number | null {
  if (mediaStream === null) {
    return null;
  }

  const videoTrack = mediaStream.getVideoTracks()[0];

  if (videoTrack === undefined) {
    return null;
  }

  const frameRate = videoTrack.getSettings().frameRate;

  if (frameRate === undefined || !Number.isFinite(frameRate)) {
    return null;
  }

  return frameRate;
}

/** Re-applies frame-rate constraints and reports capability limits for diagnostics. */
export async function negotiateCameraFrameRate(
  mediaStream: MediaStream,
  frameRateSelection: CameraFrameRateSelection,
): Promise<CameraFrameRateNegotiationResult> {
  const videoTrack = mediaStream.getVideoTracks()[0];

  if (videoTrack === undefined) {
    return {
      actualFrameRate: null,
      capabilityMinFrameRate: null,
      capabilityMaxFrameRate: null,
      frameRateMismatch: false,
    };
  }

  const [capabilityMinFrameRate, capabilityMaxFrameRate] =
    readVideoTrackFrameRateCapabilities(videoTrack);
  const targetFrameRate = parseExplicitFrameRateFromSelection(frameRateSelection);
  const frameRateConstraint = buildCameraFrameRateConstraint(frameRateSelection);
  let actualFrameRate = readVideoTrackFrameRate(mediaStream);

  if (
    frameRateConstraint !== undefined &&
    targetFrameRate !== null &&
    (actualFrameRate === null || !frameRatesMatch(targetFrameRate, actualFrameRate))
  ) {
    try {
      await videoTrack.applyConstraints({ frameRate: frameRateConstraint });
      actualFrameRate = readVideoTrackFrameRate(mediaStream);
    } catch {
      // Guard: browsers may reject a strict frame-rate renegotiation at the current resolution.
    }
  }

  const frameRateMismatch =
    targetFrameRate !== null &&
    actualFrameRate !== null &&
    !frameRatesMatch(targetFrameRate, actualFrameRate);

  return {
    actualFrameRate,
    capabilityMinFrameRate,
    capabilityMaxFrameRate,
    frameRateMismatch,
  };
}

/** Returns true when the device capability range cannot satisfy the requested frame rate. */
export function isRequestedFrameRateUnsupported(
  frameRateSelection: CameraFrameRateSelection,
  capabilityMaxFrameRate: number | null,
): boolean {
  const targetFrameRate = parseExplicitFrameRateFromSelection(frameRateSelection);

  if (targetFrameRate === null || capabilityMaxFrameRate === null) {
    return false;
  }

  return capabilityMaxFrameRate + FRAME_RATE_MATCH_TOLERANCE_FPS < targetFrameRate;
}
