/**
 * Diagnostics and status text formatting for the 16-cube AprilCube demo UI.
 */
import { MULTI_CUBE_CONFIG_COUNT } from "./constants.js";
import { buildMultiCubePalette } from "./multi-cube-color.js";
import { readMultiCubeModelLabel } from "./multi-cube-model-assignment.js";
import type {
  MultiCubeAppDomElements,
  MultiCubeAppRuntimeState,
  MultiCubePerCubeStatus,
} from "./multi-cube-runtime.js";
import {
  cameraResolutionMatchesRequest,
  formatCameraResolutionLabel,
  type CameraResolutionPixels,
} from "./camera-resolution.js";
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

function formatMultiCubeConfigStatus(state: MultiCubeAppRuntimeState): string {
  if (state.multiCubeConfigLoading) {
    return "loading 16 cube configs…";
  }

  if (state.multiCubeConfigLoadError !== null) {
    return `config error: ${state.multiCubeConfigLoadError}`;
  }

  if (state.multiCubeConfigSet === null) {
    return "config: not loaded";
  }

  const configSet = state.multiCubeConfigSet;
  const totalTagCount = configSet.unionTagIdSet.size;
  const minTagId = Math.min(...configSet.unionTagIdSet);
  const maxTagId = Math.max(...configSet.unionTagIdSet);

  return `loaded: ${configSet.cubeCount} cubes | dict=${configSet.kiboTagFamilyName} | tags=${totalTagCount} (${minTagId}..${maxTagId})`;
}

function formatDiagnostics(state: MultiCubeAppRuntimeState): string {
  const lines = [
    `lifecycle: ${state.lifecycleState}`,
    `cameraLabel: ${state.mediaStream?.getVideoTracks()[0]?.label ?? "none"}`,
    `intrinsicsSource: ${state.intrinsicsSource}`,
    `distortionCoeffCount: ${state.distortionCoefficients.length}`,
    `multiCubeConfigLoaded: ${state.multiCubeConfigSet !== null}`,
    `multiCubeConfigLoading: ${state.multiCubeConfigLoading}`,
    `multiCubeConfigError: ${state.multiCubeConfigLoadError ?? "none"}`,
    `threeOverlayLoaded: ${state.threeOverlaySession !== null}`,
    `threeOverlayLoadError: ${state.threeOverlayLoadError ?? "none"}`,
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

  lines.push(`detectedMarkerCount: ${state.detectedMarkers.length}`);

  const trackingCount = state.perCubeStatuses.filter(
    (s) => s.trackerState === "tracking",
  ).length;
  const coastingCount = state.perCubeStatuses.filter(
    (s) => s.trackerState === "coasting",
  ).length;
  const lostCount = state.perCubeStatuses.filter(
    (s) => s.trackerState === "lost",
  ).length;

  lines.push(
    `cubeTracking: ${trackingCount}/${MULTI_CUBE_CONFIG_COUNT}`,
    `cubeCoasting: ${coastingCount}/${MULTI_CUBE_CONFIG_COUNT}`,
    `cubeLost: ${lostCount}/${MULTI_CUBE_CONFIG_COUNT}`,
  );

  return lines.join("\n");
}

function formatPerCubeStatusRow(status: MultiCubePerCubeStatus, cubeColor: string): string {
  const reprojText =
    status.reprojectionErrorPx === null
      ? "—"
      : `${status.reprojectionErrorPx.toFixed(2)}px`;

  const failureText =
    status.poseFailureReason === null ? "" : ` reason=${status.poseFailureReason}`;

  const tagRangeText =
    status.tagIds.length === 0
      ? "—"
      : `${status.tagIds[0]}..${status.tagIds[status.tagIds.length - 1]}`;

  const modelLabel = readMultiCubeModelLabel(status.cubeIndex);

  return `[${status.cubeIndex.toString().padStart(2, "0")}] ${status.trackerState.padEnd(8)} markers=${status.detectedMarkerCount} ${status.poseMode} reproj=${reprojText}${failureText} tags=${tagRangeText} model=${modelLabel} color=${cubeColor}`;
}

function renderPerCubeStatusGrid(
  perCubeStatusGridElement: HTMLElement,
  state: MultiCubeAppRuntimeState,
): void {
  const palette = buildMultiCubePalette();

  const lines = state.perCubeStatuses.map((status, cubeIndex) => {
    const cubeColor = palette[cubeIndex] ?? "hsl(0,0%,50%)";
    return formatPerCubeStatusRow(status, cubeColor);
  });

  perCubeStatusGridElement.textContent = lines.join("\n");
}

/** Formats the camera status line shown in the multi-cube demo UI. */
export function formatMultiCubeCameraStatusMessage(
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

  return `${resolutionMessage}${resolutionSuffix}${facingModeSuffix} @ ${startupResult.actualFrameRate.toFixed(1)} fps`;
}

/** Updates all status elements and per-cube grid from the current multi-cube runtime state. */
export function updateMultiCubeAppUi(
  domElements: MultiCubeAppDomElements,
  state: MultiCubeAppRuntimeState,
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
  domElements.multiCubeConfigStatusElement.textContent = formatMultiCubeConfigStatus(state);
  domElements.detectedMarkersTextElement.textContent = `Detected markers: ${state.detectedMarkers.length}`;

  renderPerCubeStatusGrid(domElements.perCubeStatusGridElement, state);

  const configsReady = state.multiCubeConfigSet !== null && state.multiCubeConfigLoadError === null;
  const detectorGateReady =
    state.lifecycleState === "resolutionReady" && configsReady && !state.multiCubeConfigLoading;
  domElements.startDetectorButton.disabled = !detectorGateReady;

  const cameraControlsLocked =
    state.lifecycleState !== "idle" && state.lifecycleState !== "failed";
  const cameraProbeInProgress = domElements.cameraFrameRateSelect.dataset.probeComplete !== "true";
  domElements.cameraFacingModeSelect.disabled = cameraControlsLocked || cameraProbeInProgress;
  domElements.cameraResolutionSelect.disabled = cameraControlsLocked || cameraProbeInProgress;
  domElements.cameraFrameRateSelect.disabled = cameraControlsLocked || cameraProbeInProgress;
  domElements.probeFrameRatesButton.disabled = cameraControlsLocked || cameraProbeInProgress;
  domElements.loadConfigsButton.disabled =
    state.multiCubeConfigLoading || state.lifecycleState === "tracking";
  domElements.calibrationStatusElement.textContent = `calibration: ${state.intrinsicsSource}`;
}
