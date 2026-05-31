/**
 * Demo application event handlers: camera startup, detector, calibration, capture options.
 */
import {
  buildAprilCubeConfigFromLayoutJson,
  EXAMPLE_APRILCUBE_LAYOUT_JSON,
} from "./aprilcube-config.js";
import { captureVideoFrameToGrayscale } from "./camera.js";
import {
  INTRINSICS_REFERENCE_HEIGHT_PIXELS,
  INTRINSICS_REFERENCE_WIDTH_PIXELS,
  CAMERA_FRAME_RATE_DEFAULT_HINT_MESSAGE,
} from "./constants.js";
import {
  buildFrameRateProbeResultFromMediaStream,
  formatCameraFrameRateProbeMessage,
  probeCameraFrameRateOptions,
  readSelectedCameraFrameRateSelection,
  renderCameraFrameRateSelectOptions,
  renderDefaultCameraFrameRateSelectOptions,
} from "./camera-frame-rate.js";
import {
  formatCameraResolutionLabel,
  readSelectedCameraResolution,
  renderCameraResolutionSelectOptions,
  type CameraResolutionPixels,
} from "./camera-resolution.js";
import { startCamera } from "./camera-startup.js";
import { initializeKiboTagDetector } from "./kibo-tag-detector.js";
import type { AppDomElements, AppRuntimeState } from "./app-runtime.js";
import { buildOverlayDrawInput } from "./app-overlay-session.js";
import { startTrackingLoop } from "./app-tracking-loop.js";
import { formatCameraStatusMessage, updateAppUi } from "./app-ui-text.js";
import { drawOverlay } from "./overlay.js";
import { parseCalibrationJson } from "./parse-calibration-json.js";
import {
  clearPersistedCalibration,
  persistCalibrationJson,
  resolveReferenceCameraIntrinsics,
} from "./resolve-reference-intrinsics.js";
import {
  synchronizeOverlayCanvasSize,
  validateResolutionConsistency,
} from "./resolution-gate.js";
import { syncViewportCaptureAspectRatio } from "./viewport-layout.js";

/** Starts the camera and runs resolution / intrinsics gates. */
export async function handleStartCamera(
  domElements: AppDomElements,
  state: AppRuntimeState,
): Promise<void> {
  state.lifecycleState = "startingCamera";
  state.poseTracker.reset();
  state.requestedCameraResolution = readSelectedCameraResolution(domElements.cameraResolutionSelect);
  state.requestedCameraFrameRateSelection = readSelectedCameraFrameRateSelection(
    domElements.cameraFrameRateSelect,
  );
  updateAppUi(domElements, state, "starting", "pending", "not started", "not estimated");

  const startupResult = await startCamera(
    {
      videoElement: domElements.videoElement,
      captureCanvas: domElements.captureCanvas,
    },
    {
      frameRateSelection: state.requestedCameraFrameRateSelection,
      resolution: state.requestedCameraResolution,
    },
  );

  if (!startupResult.success) {
    state.lifecycleState = "failed";
    updateAppUi(
      domElements,
      state,
      `${startupResult.reason}: ${startupResult.detail}`,
      "blocked",
      "blocked",
      "blocked",
    );
    return;
  }

  state.mediaStream = startupResult.mediaStream;
  state.actualCameraFrameRate = startupResult.actualFrameRate;
  state.cameraFrameRateCapabilityMin = startupResult.capabilityMinFrameRate;
  state.cameraFrameRateCapabilityMax = startupResult.capabilityMaxFrameRate;
  state.cameraFrameRateMismatch = startupResult.frameRateMismatch;
  applyFrameRateOptionsFromActiveStream(
    domElements,
    startupResult.mediaStream,
    state.requestedCameraResolution,
  );
  state.lifecycleState = "cameraReady";
  synchronizeOverlayCanvasSize(domElements.captureCanvas, domElements.overlayCanvas);
  syncViewportCaptureAspectRatio(
    domElements.viewportElement,
    startupResult.videoWidth,
    startupResult.videoHeight,
  );

  const frameCapture = captureVideoFrameToGrayscale(
    domElements.videoElement,
    domElements.captureCanvas,
  );

  if (frameCapture === null) {
    state.lifecycleState = "failed";
    updateAppUi(domElements, state, "cameraReady", "emptyFrame", "blocked", "blocked");
    return;
  }

  const resolutionResult = validateResolutionConsistency({
    videoWidth: startupResult.videoWidth,
    videoHeight: startupResult.videoHeight,
    captureCanvas: domElements.captureCanvas,
    overlayCanvas: domElements.overlayCanvas,
    grayscaleBufferLength: frameCapture.grayscaleBuffer.length,
    referenceCameraIntrinsics: resolveReferenceCameraIntrinsics().referenceCameraIntrinsics,
  });

  if (!resolutionResult.success) {
    state.lifecycleState = "failed";
    updateAppUi(
      domElements,
      state,
      "cameraReady",
      `${resolutionResult.reason}: ${resolutionResult.detail}`,
      "blocked",
      "blocked",
    );
    return;
  }

  state.lifecycleState = "resolutionReady";
  state.scaledCameraIntrinsics = resolutionResult.scaledCameraIntrinsics;
  state.resolutionSnapshot = resolutionResult.snapshot;
  state.intrinsicsSource = resolutionResult.intrinsicsArePlaceholder
    ? "placeholder"
    : "calibrated";

  const aprilCubeConfig = buildAprilCubeConfigFromLayoutJson(
    EXAMPLE_APRILCUBE_LAYOUT_JSON,
    "reversedCanonical",
  );

  drawOverlay(
    buildOverlayDrawInput(
      domElements,
      state,
      [],
      null,
      aprilCubeConfig.cubeSize,
    ),
  );

  updateAppUi(
    domElements,
    state,
    formatCameraStatusMessage(
      startupResult.videoWidth,
      startupResult.videoHeight,
      startupResult.actualFrameRate,
      state.requestedCameraResolution,
      startupResult.requestedFrameRateSelection,
      startupResult.frameRateMismatch,
      startupResult.capabilityMaxFrameRate,
    ),
    "resolutionReady",
    "not started",
    state.intrinsicsSource === "placeholder" ? "approximate intrinsics" : "calibrated intrinsics",
  );
}

/** Loads the kibo-tag detector and starts the tracking loop. */
export async function handleStartDetector(
  domElements: AppDomElements,
  state: AppRuntimeState,
): Promise<void> {
  if (state.lifecycleState !== "resolutionReady") {
    return;
  }

  state.lifecycleState = "loadingDetector";
  updateAppUi(
    domElements,
    state,
    domElements.cameraStatusElement.textContent ?? "cameraReady",
    "resolutionReady",
    "loading",
    "waiting",
  );

  const detectorLoadResult = await initializeKiboTagDetector();

  if (!detectorLoadResult.success) {
    state.lifecycleState = "failed";
    updateAppUi(
      domElements,
      state,
      domElements.cameraStatusElement.textContent ?? "cameraReady",
      "resolutionReady",
      `${detectorLoadResult.reason}: ${detectorLoadResult.detail}`,
      "blocked",
    );
    return;
  }

  state.detector = detectorLoadResult.detector;
  state.lifecycleState = "tracking";
  updateAppUi(
    domElements,
    state,
    domElements.cameraStatusElement.textContent ?? "cameraReady",
    "resolutionReady",
    "detectorReady",
    "starting",
  );
  startTrackingLoop(domElements, state);
}

/** Persists calibration JSON from the UI textarea. */
export function handleApplyCalibration(
  domElements: AppDomElements,
  state: AppRuntimeState,
): void {
  const parseResult = parseCalibrationJson(domElements.calibrationJsonInput.value);

  if (!parseResult.success) {
    domElements.calibrationStatusElement.textContent =
      `calibration error: ${parseResult.reason} (${parseResult.detail})`;
    return;
  }

  persistCalibrationJson(domElements.calibrationJsonInput.value.trim());
  state.intrinsicsSource = "calibrated";
  state.distortionCoefficients = parseResult.distortionCoefficients;
  domElements.calibrationStatusElement.textContent =
    "calibration: saved (restart camera to apply)";
}

/** Clears persisted calibration and resets distortion coefficients. */
export function handleClearCalibration(
  domElements: AppDomElements,
  state: AppRuntimeState,
): void {
  clearPersistedCalibration();
  domElements.calibrationJsonInput.value = "";
  const resolvedIntrinsics = resolveReferenceCameraIntrinsics();
  state.intrinsicsSource = resolvedIntrinsics.intrinsicsSource;
  state.distortionCoefficients = resolvedIntrinsics.distortionCoefficients;
  domElements.calibrationStatusElement.textContent =
    "calibration: cleared (restart camera to apply)";
}

/** Initializes capture controls without opening the camera. */
export function initializeCameraCaptureOptions(domElements: AppDomElements): void {
  initializeCameraCaptureControls(domElements);
  renderDefaultCameraFrameRateSelectOptions(domElements.cameraFrameRateSelect);
  domElements.cameraFrameRateSelect.disabled = false;
  domElements.cameraFrameRateSelect.dataset.probeComplete = "true";
  domElements.cameraFrameRateHintElement.textContent = CAMERA_FRAME_RATE_DEFAULT_HINT_MESSAGE;
}

/** Updates viewport preview when resolution changes without opening the camera. */
export function syncCameraCaptureResolutionPreview(domElements: AppDomElements): void {
  const selectedResolution = readSelectedCameraResolution(domElements.cameraResolutionSelect);
  syncViewportCaptureAspectRatio(
    domElements.viewportElement,
    selectedResolution.widthPixels,
    selectedResolution.heightPixels,
  );
  renderDefaultCameraFrameRateSelectOptions(domElements.cameraFrameRateSelect);
  domElements.cameraFrameRateHintElement.textContent =
    `Resolution preview ${formatCameraResolutionLabel(selectedResolution)}. ${CAMERA_FRAME_RATE_DEFAULT_HINT_MESSAGE}`;
}

/** Refines fps options from an already-open camera stream. */
export function applyFrameRateOptionsFromActiveStream(
  domElements: AppDomElements,
  mediaStream: MediaStream,
  resolution: CameraResolutionPixels,
): void {
  const probeResult = buildFrameRateProbeResultFromMediaStream(mediaStream, resolution);

  if (probeResult.success) {
    renderCameraFrameRateSelectOptions(
      domElements.cameraFrameRateSelect,
      probeResult.supportedCandidateFrameRates,
    );
  }

  domElements.cameraFrameRateSelect.dataset.probeComplete = "true";
  domElements.cameraFrameRateHintElement.textContent = formatCameraFrameRateProbeMessage(
    probeResult,
    resolution,
  );
}

/** Optionally probes frame-rate limits in a brief separate camera session. */
export async function handleProbeCameraFrameRates(
  domElements: AppDomElements,
  state: AppRuntimeState,
): Promise<void> {
  const selectedResolution = readSelectedCameraResolution(domElements.cameraResolutionSelect);

  domElements.cameraFrameRateSelect.dataset.probeComplete = "false";
  domElements.cameraFrameRateHintElement.textContent =
    `Probing frame rates at ${formatCameraResolutionLabel(selectedResolution)}…`;
  updateAppUi(
    domElements,
    state,
    domElements.cameraStatusElement.textContent ?? "not started",
    domElements.resolutionStatusElement.textContent ?? "not checked",
    domElements.detectorStatusElement.textContent ?? "not started",
    domElements.poseStatusElement.textContent ?? "not estimated",
  );

  const probeResult = await probeCameraFrameRateOptions(selectedResolution);

  if (probeResult.success) {
    renderCameraFrameRateSelectOptions(
      domElements.cameraFrameRateSelect,
      probeResult.supportedCandidateFrameRates,
    );
  }

  domElements.cameraFrameRateSelect.dataset.probeComplete = "true";
  domElements.cameraFrameRateHintElement.textContent = formatCameraFrameRateProbeMessage(
    probeResult,
    selectedResolution,
  );
  updateAppUi(
    domElements,
    state,
    domElements.cameraStatusElement.textContent ?? "not started",
    domElements.resolutionStatusElement.textContent ?? "not checked",
    domElements.detectorStatusElement.textContent ?? "not started",
    domElements.poseStatusElement.textContent ?? "not estimated",
  );
}

/** Initializes camera resolution select options on first load. */
export function initializeCameraCaptureControls(domElements: AppDomElements): void {
  renderCameraResolutionSelectOptions(domElements.cameraResolutionSelect);
  syncViewportCaptureAspectRatio(
    domElements.viewportElement,
    INTRINSICS_REFERENCE_WIDTH_PIXELS,
    INTRINSICS_REFERENCE_HEIGHT_PIXELS,
  );
}
