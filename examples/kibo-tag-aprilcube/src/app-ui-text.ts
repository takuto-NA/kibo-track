/**
 * Diagnostics and status text formatting for the AprilCube demo UI.
 */
import type { Pose } from "kibo-track";
import {
  cameraResolutionMatchesRequest,
  formatCameraResolutionLabel,
  type CameraResolutionPixels,
} from "./camera-resolution.js";
import { formatPoseDisplayLines } from "./format-pose-display.js";
import type { AppDomElements, AppRuntimeState } from "./app-runtime.js";
import type { CameraFrameRateSelection, CameraStartupSuccess } from "./types.js";

function formatFrameRateCapabilityRange(
  capabilityMinFrameRate: number | null,
  capabilityMaxFrameRate: number | null,
): string {
  if (capabilityMinFrameRate === null && capabilityMaxFrameRate === null) {
    return "unknown";
  }

  return `${capabilityMinFrameRate ?? "?"}-${capabilityMaxFrameRate ?? "?"} fps`;
}

function formatDiagnostics(state: AppRuntimeState): string {
  const trackerSnapshot = state.poseTracker.getSnapshot();
  const lines = [
    `lifecycle: ${state.lifecycleState}`,
    `cameraLabel: ${state.mediaStream?.getVideoTracks()[0]?.label ?? "none"}`,
    `intrinsicsSource: ${state.intrinsicsSource}`,
    `distortionCoeffCount: ${state.distortionCoefficients.length}`,
    `trackerState: ${trackerSnapshot.trackerState}`,
    `coastFrameCount: ${trackerSnapshot.coastFrameCount}`,
    `detectedMarkerCount: ${state.detectedMarkers.length}`,
    `overlayDisplayMode: ${state.overlayDisplayMode}`,
    `requestedCameraFacingMode: ${state.requestedCameraFacingModeSelection}`,
    `actualCameraFacingMode: ${state.actualCameraFacingMode ?? "unknown"}`,
    `requestedCameraResolution: ${formatCameraResolutionLabel(state.requestedCameraResolution)}`,
    `requestedCameraFrameRate: ${state.requestedCameraFrameRateSelection}`,
    `actualCameraFrameRate: ${state.actualCameraFrameRate ?? "unknown"}`,
    `cameraFrameRateCapability: ${formatFrameRateCapabilityRange(
      state.cameraFrameRateCapabilityMin,
      state.cameraFrameRateCapabilityMax,
    )}`,
    `cameraFrameRateMismatch: ${state.cameraFrameRateMismatch}`,
  ];

  if (state.resolutionSnapshot !== null) {
    lines.push(
      `video: ${state.resolutionSnapshot.videoWidth}x${state.resolutionSnapshot.videoHeight}`,
      `captureCanvas: ${state.resolutionSnapshot.captureCanvasWidth}x${state.resolutionSnapshot.captureCanvasHeight}`,
      `overlayCanvas: ${state.resolutionSnapshot.overlayCanvasWidth}x${state.resolutionSnapshot.overlayCanvasHeight}`,
      `overlayCss: ${state.resolutionSnapshot.overlayCssWidth.toFixed(1)}x${state.resolutionSnapshot.overlayCssHeight.toFixed(1)}`,
      `devicePixelRatio: ${state.resolutionSnapshot.devicePixelRatio}`,
      `grayscaleLength: ${state.resolutionSnapshot.grayscaleBufferLength}`,
      `intrinsicsReference: ${state.resolutionSnapshot.intrinsicsReferenceWidth}x${state.resolutionSnapshot.intrinsicsReferenceHeight}`,
    );
  }

  if (state.scaledCameraIntrinsics !== null) {
    lines.push(
      `scaledFx: ${state.scaledCameraIntrinsics.focalLengthX.toFixed(2)}`,
      `scaledFy: ${state.scaledCameraIntrinsics.focalLengthY.toFixed(2)}`,
      `scaledCx: ${state.scaledCameraIntrinsics.principalPointX.toFixed(2)}`,
      `scaledCy: ${state.scaledCameraIntrinsics.principalPointY.toFixed(2)}`,
    );
  }

  if (state.latestPoseResult !== null) {
    if (state.latestPoseResult.success) {
      lines.push(
        `poseSuccess: true`,
        `poseMode: ${state.latestPoseResult.poseMode}`,
        `visibleFaceCount: ${state.latestPoseResult.visibleFaceCount}`,
        `detectedMarkerIds: ${state.latestPoseResult.detectedMarkerIds.join(",")}`,
        `correspondenceCount: ${state.latestPoseResult.correspondenceCount}`,
        `finalReprojectionPx: ${state.latestPoseResult.finalMeanReprojectionErrorPx.toExponential(3)}`,
        `confidence: ${state.latestPoseResult.confidence.toFixed(4)}`,
        `numInliers: ${state.latestPoseResult.numInliers}`,
      );

      if (state.latestPoseResult.planarCandidateCount !== undefined) {
        lines.push(`planarCandidateCount: ${state.latestPoseResult.planarCandidateCount}`);
      }

      if (state.latestPoseResult.planarAmbiguityScore !== undefined) {
        lines.push(
          `planarAmbiguityScore: ${state.latestPoseResult.planarAmbiguityScore.toExponential(3)}`,
        );
      }

      if (state.latestPoseResult.rejectedMarkerIds.length > 0) {
        lines.push(`rejectedMarkerIds: ${state.latestPoseResult.rejectedMarkerIds.join(",")}`);
      }
    } else {
      lines.push(
        `poseSuccess: false`,
        `poseStage: ${state.latestPoseResult.stage}`,
        `poseReason: ${state.latestPoseResult.reason}`,
      );
    }
  }

  return lines.join("\n");
}

function formatDetectionResults(state: AppRuntimeState): string {
  if (state.detectedMarkers.length === 0) {
    return "Detected markers: none";
  }

  const detectedMarkerIds = state.detectedMarkers.map((marker) => marker.id).join(", ");
  const lines = [`Detected markers: ${detectedMarkerIds}`];

  if (state.latestPoseResult === null) {
    return lines.join("\n");
  }

  if (state.latestPoseResult.success) {
    lines.push(
      `Measured: ${state.latestPoseResult.poseMode} · ${state.latestPoseResult.finalMeanReprojectionErrorPx.toFixed(2)} px`,
    );

    const displayPose: Pose = state.trackedPose ?? state.latestPoseResult.pose;
    lines.push(...formatPoseDisplayLines(displayPose));

    if (state.latestPoseResult.rejectedMarkerIds.length > 0) {
      lines.push(`Rejected markers: ${state.latestPoseResult.rejectedMarkerIds.join(", ")}`);
    }

    return lines.join("\n");
  }

  lines.push(`Pose: failed (${state.latestPoseResult.stage}: ${state.latestPoseResult.reason})`);
  return lines.join("\n");
}

/** Formats the camera status line shown in the demo UI. */
export function formatCameraStatusMessage(
  startupResult: CameraStartupSuccess,
  requestedResolution: CameraResolutionPixels,
): string {
  const resolutionMessage = `cameraReady ${startupResult.videoWidth}x${startupResult.videoHeight}`;
  const facingModeSuffix =
    startupResult.actualFacingMode !== null &&
    startupResult.actualFacingMode !== startupResult.requestedFacingModeSelection
      ? ` (requested ${startupResult.requestedFacingModeSelection}, got ${startupResult.actualFacingMode})`
      : startupResult.actualFacingMode !== null
        ? ` (${startupResult.actualFacingMode})`
        : ` (${startupResult.requestedFacingModeSelection})`;
  const resolutionMismatch = !cameraResolutionMatchesRequest(
    requestedResolution,
    startupResult.videoWidth,
    startupResult.videoHeight,
  );
  const resolutionSuffix = resolutionMismatch
    ? ` (requested ${formatCameraResolutionLabel(requestedResolution)})`
    : "";

  if (startupResult.actualFrameRate === null) {
    return `${resolutionMessage}${resolutionSuffix}${facingModeSuffix}`;
  }

  const frameRateMessage = `${resolutionMessage}${resolutionSuffix}${facingModeSuffix} @ ${startupResult.actualFrameRate.toFixed(1)} fps`;

  if (!startupResult.frameRateMismatch) {
    return frameRateMessage;
  }

  if (startupResult.requestedFrameRateSelection !== "deviceDefault") {
    const capabilityHint =
      startupResult.capabilityMaxFrameRate !== null
        ? `, device max ${startupResult.capabilityMaxFrameRate.toFixed(0)} at this resolution`
        : "";

    return `${frameRateMessage} (requested ${startupResult.requestedFrameRateSelection} fps${capabilityHint})`;
  }

  return frameRateMessage;
}

/** Updates all status elements from the current runtime state. */
export function updateAppUi(
  domElements: AppDomElements,
  state: AppRuntimeState,
  cameraMessage: string,
  resolutionMessage: string,
  detectorMessage: string,
  poseMessage: string,
): void {
  domElements.appStatusElement.textContent = state.lifecycleState;
  domElements.cameraStatusElement.textContent = cameraMessage;
  domElements.resolutionStatusElement.textContent = resolutionMessage;
  domElements.detectorStatusElement.textContent = detectorMessage;
  domElements.poseStatusElement.textContent = poseMessage;
  domElements.diagnosticsTextElement.textContent = formatDiagnostics(state);
  domElements.detectionResultsTextElement.textContent = formatDetectionResults(state);
  domElements.startDetectorButton.disabled = state.lifecycleState !== "resolutionReady";
  const cameraControlsLocked =
    state.lifecycleState !== "idle" && state.lifecycleState !== "failed";
  const cameraProbeInProgress = domElements.cameraFrameRateSelect.dataset.probeComplete !== "true";
  domElements.cameraFacingModeSelect.disabled = cameraControlsLocked || cameraProbeInProgress;
  domElements.cameraResolutionSelect.disabled = cameraControlsLocked || cameraProbeInProgress;
  domElements.cameraFrameRateSelect.disabled = cameraControlsLocked || cameraProbeInProgress;
  domElements.probeFrameRatesButton.disabled = cameraControlsLocked || cameraProbeInProgress;
  domElements.calibrationStatusElement.textContent = `calibration: ${state.intrinsicsSource}`;
}
