/**
 * Multi-cube demo application entrypoint: binds DOM events for 16 independent AprilCube tracking.
 */
import { stopCameraStream } from "./camera-startup.js";
import {
  createInitialMultiCubeAppRuntimeState,
  readMultiCubeAppDomElements,
  resetMultiCubeTrackingState,
  type MultiCubeAppDomElements,
  type MultiCubeAppRuntimeState,
} from "./multi-cube-runtime.js";
import {
  buildFrameRateProbeResultFromMediaStream,
  formatCameraFrameRateProbeMessage,
  probeCameraFrameRateOptions,
  readSelectedCameraFrameRateSelection,
  renderCameraFrameRateSelectOptions,
  renderDefaultCameraFrameRateSelectOptions,
} from "./camera-frame-rate.js";
import {
  readSelectedCameraFacingModeSelection,
  renderCameraFacingModeSelectOptions,
} from "./camera-facing-mode.js";
import {
  formatCameraResolutionLabel,
  readSelectedCameraResolution,
  renderCameraResolutionSelectOptions,
  type CameraResolutionPixels,
} from "./camera-resolution.js";
import { startCamera } from "./camera-startup.js";
import { captureVideoFrameToGrayscale } from "./camera.js";
import {
  initializeKiboTagDetector,
  resetCachedKiboTagDetector,
} from "./kibo-tag-detector.js";
import {
  synchronizeOverlayCanvasSize,
  validateResolutionConsistency,
} from "./resolution-gate.js";
import { syncViewportCaptureAspectRatio } from "./viewport-layout.js";
import { parseCalibrationJson } from "./parse-calibration-json.js";
import {
  clearPersistedCalibration,
  persistCalibrationJson,
  resolveReferenceCameraIntrinsics,
} from "./resolve-reference-intrinsics.js";
import { drawMultiCubeOverlay } from "./multi-cube-overlay.js";
import {
  startMultiCubeTrackingLoop,
  stopMultiCubeTrackingLoop,
} from "./multi-cube-tracking-loop.js";
import { updateMultiCubeAppUi } from "./multi-cube-ui-text.js";
import { formatMultiCubeCameraStatusMessage } from "./multi-cube-ui-text.js";
import { loadMultiCubeConfigSet } from "./multi-cube-config.js";
import { readOverlayDisplayModeFromSelectValue } from "./overlay-display-mode.js";
import { readCornerOrderFromSelectValue } from "./read-corner-order-selection.js";
import {
  CAMERA_FRAME_RATE_DEFAULT_HINT_MESSAGE,
  INTRINSICS_REFERENCE_HEIGHT_PIXELS,
  INTRINSICS_REFERENCE_WIDTH_PIXELS,
  MULTI_CUBE_CONFIG_COUNT,
} from "./constants.js";
import type { OverlayDisplayMode } from "./types.js";

function bindMultiCubeApplication(): void {
  const domElements = readMultiCubeAppDomElements();
  const state = createInitialMultiCubeAppRuntimeState();

  // Render overlay select options for the multi-cube page (wireframe-only modes).
  const overlaySelect = domElements.overlayDisplayModeSelect;
  overlaySelect.replaceChildren();
  const overlayOptions: ReadonlyArray<{ readonly value: OverlayDisplayMode; readonly label: string }> = [
    { value: "cameraWithWireframe", label: "Camera + wireframe" },
    { value: "wireframeOnly", label: "Wireframe only" },
  ];
  for (const optionDefinition of overlayOptions) {
    const optionElement = document.createElement("option");
    optionElement.value = optionDefinition.value;
    optionElement.textContent = optionDefinition.label;
    overlaySelect.appendChild(optionElement);
  }
  overlaySelect.value = "cameraWithWireframe";

  function refreshOverlayDisplayMode(): void {
    state.overlayDisplayMode = readOverlayDisplayModeFromSelectValue(overlaySelect.value);
    domElements.viewportElement.classList.toggle(
      "viewport-overlay-only-background",
      state.overlayDisplayMode === "wireframeOnly",
    );
  }

  function redrawCurrentMultiCubeOverlayFrame(): void {
    if (state.scaledCameraIntrinsics === null || state.multiCubeConfigSet === null) {
      return;
    }

    drawMultiCubeOverlay({
      overlayCanvas: domElements.overlayCanvas,
      captureCanvas: domElements.captureCanvas,
      detectedMarkers: state.detectedMarkers,
      cubePoses: state.trackedPoses,
      boxDimensionsMeters: state.multiCubeConfigSet.cubes[0]!.boxDimensionsMeters,
      cameraIntrinsics: state.scaledCameraIntrinsics,
      distortionCoefficients: state.distortionCoefficients,
      overlayDisplayMode: state.overlayDisplayMode,
    });
  }

  async function handleLoadMultiCubeConfigs(): Promise<void> {
    if (state.multiCubeConfigLoading) {
      return;
    }

    state.multiCubeConfigLoading = true;
    updateMultiCubeAppUi(
      domElements,
      state,
      domElements.cameraStatusElement.textContent ?? "not started",
      domElements.resolutionStatusElement.textContent ?? "not checked",
      domElements.detectorStatusElement.textContent ?? "not started",
      domElements.poseStatusElement.textContent ?? "not estimated",
    );

    const cornerOrder = readCornerOrderFromSelectValue(domElements.cornerOrderSelect.value);
    const loadResult = await loadMultiCubeConfigSet(cornerOrder);

    state.multiCubeConfigLoading = false;

    if (!loadResult.success) {
      state.multiCubeConfigSet = null;
      state.multiCubeConfigLoadError = loadResult.detail;
      updateMultiCubeAppUi(
        domElements,
        state,
        domElements.cameraStatusElement.textContent ?? "not started",
        domElements.resolutionStatusElement.textContent ?? "not checked",
        "blocked: invalid config",
        "blocked",
      );
      return;
    }

    state.multiCubeConfigSet = loadResult.configSet;
    state.multiCubeConfigLoadError = null;
    resetMultiCubeTrackingState(state);

    updateMultiCubeAppUi(
      domElements,
      state,
      domElements.cameraStatusElement.textContent ?? "not started",
      domElements.resolutionStatusElement.textContent ?? "not checked",
      domElements.detectorStatusElement.textContent ?? "not started",
      domElements.poseStatusElement.textContent ?? "not estimated",
    );

    if (state.scaledCameraIntrinsics !== null) {
      redrawCurrentMultiCubeOverlayFrame();
    }
  }

  async function handleStartCamera(): Promise<void> {
    state.lifecycleState = "startingCamera";
    resetMultiCubeTrackingState(state);
    state.requestedCameraFacingModeSelection = readSelectedCameraFacingModeSelection(
      domElements.cameraFacingModeSelect,
    );
    state.requestedCameraResolution = readSelectedCameraResolution(
      domElements.cameraResolutionSelect,
    );
    state.requestedCameraFrameRateSelection = readSelectedCameraFrameRateSelection(
      domElements.cameraFrameRateSelect,
    );
    updateMultiCubeAppUi(domElements, state, "starting", "pending", "not started", "not estimated");

    const startupResult = await startCamera(
      {
        videoElement: domElements.videoElement,
        captureCanvas: domElements.captureCanvas,
      },
      {
        frameRateSelection: state.requestedCameraFrameRateSelection,
        resolution: state.requestedCameraResolution,
        facingModeSelection: state.requestedCameraFacingModeSelection,
      },
    );

    if (!startupResult.success) {
      state.lifecycleState = "failed";
      updateMultiCubeAppUi(
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
    state.actualCameraFacingMode = startupResult.actualFacingMode;
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
      updateMultiCubeAppUi(domElements, state, "cameraReady", "emptyFrame", "blocked", "blocked");
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
      updateMultiCubeAppUi(
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

    drawMultiCubeOverlay({
      overlayCanvas: domElements.overlayCanvas,
      captureCanvas: domElements.captureCanvas,
      detectedMarkers: [],
      cubePoses: new Array(MULTI_CUBE_CONFIG_COUNT).fill(null),
      boxDimensionsMeters:
        state.multiCubeConfigSet?.cubes[0]?.boxDimensionsMeters ?? [0.032, 0.032, 0.032],
      cameraIntrinsics: state.scaledCameraIntrinsics,
      distortionCoefficients: state.distortionCoefficients,
      overlayDisplayMode: state.overlayDisplayMode,
    });

    updateMultiCubeAppUi(
      domElements,
      state,
      formatMultiCubeCameraStatusMessage(startupResult, state.requestedCameraResolution),
      "resolutionReady",
      "not started",
      state.intrinsicsSource === "placeholder" ? "approximate intrinsics" : "calibrated intrinsics",
    );
  }

  async function handleStartDetector(): Promise<void> {
    if (state.lifecycleState !== "resolutionReady") {
      return;
    }

    if (state.multiCubeConfigSet === null) {
      updateMultiCubeAppUi(
        domElements,
        state,
        domElements.cameraStatusElement.textContent ?? "cameraReady",
        "resolutionReady",
        "blocked: load configs first",
        "blocked",
      );
      return;
    }

    state.lifecycleState = "loadingDetector";
    updateMultiCubeAppUi(
      domElements,
      state,
      domElements.cameraStatusElement.textContent ?? "cameraReady",
      "resolutionReady",
      "loading",
      "waiting",
    );

    const detectorLoadResult = await initializeKiboTagDetector(
      state.multiCubeConfigSet.kiboTagFamilyName,
    );

    if (!detectorLoadResult.success) {
      state.lifecycleState = "failed";
      updateMultiCubeAppUi(
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
    updateMultiCubeAppUi(
      domElements,
      state,
      domElements.cameraStatusElement.textContent ?? "cameraReady",
      "resolutionReady",
      "detectorReady",
      "starting",
    );
    startMultiCubeTrackingLoop(domElements, state);
  }

  function handleApplyCalibrationClick(): void {
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

  function handleClearCalibrationClick(): void {
    clearPersistedCalibration();
    domElements.calibrationJsonInput.value = "";
    const resolvedIntrinsics = resolveReferenceCameraIntrinsics();
    state.intrinsicsSource = resolvedIntrinsics.intrinsicsSource;
    state.distortionCoefficients = resolvedIntrinsics.distortionCoefficients;
    domElements.calibrationStatusElement.textContent =
      "calibration: cleared (restart camera to apply)";
  }

  async function handleProbeFrameRates(): Promise<void> {
    if (state.lifecycleState !== "idle" && state.lifecycleState !== "failed") {
      return;
    }

    const selectedResolution = readSelectedCameraResolution(domElements.cameraResolutionSelect);
    const selectedFacingMode = readSelectedCameraFacingModeSelection(
      domElements.cameraFacingModeSelect,
    );

    domElements.cameraFrameRateSelect.dataset.probeComplete = "false";
    domElements.cameraFrameRateHintElement.textContent =
      `Probing frame rates at ${formatCameraResolutionLabel(selectedResolution)}…`;
    updateMultiCubeAppUi(
      domElements,
      state,
      domElements.cameraStatusElement.textContent ?? "not started",
      domElements.resolutionStatusElement.textContent ?? "not checked",
      domElements.detectorStatusElement.textContent ?? "not started",
      domElements.poseStatusElement.textContent ?? "not estimated",
    );

    const probeResult = await probeCameraFrameRateOptions(selectedResolution, selectedFacingMode);

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
    updateMultiCubeAppUi(
      domElements,
      state,
      domElements.cameraStatusElement.textContent ?? "not started",
      domElements.resolutionStatusElement.textContent ?? "not checked",
      domElements.detectorStatusElement.textContent ?? "not started",
      domElements.poseStatusElement.textContent ?? "not estimated",
    );
  }

  function applyFrameRateOptionsFromActiveStream(
    dom: MultiCubeAppDomElements,
    mediaStream: MediaStream,
    resolution: CameraResolutionPixels,
  ): void {
    const probeResult = buildFrameRateProbeResultFromMediaStream(mediaStream, resolution);

    if (probeResult.success) {
      renderCameraFrameRateSelectOptions(
        dom.cameraFrameRateSelect,
        probeResult.supportedCandidateFrameRates,
      );
    }

    dom.cameraFrameRateSelect.dataset.probeComplete = "true";
    dom.cameraFrameRateHintElement.textContent = formatCameraFrameRateProbeMessage(
      probeResult,
      resolution,
    );
  }

  function initializeCameraCaptureControls(dom: MultiCubeAppDomElements): void {
    renderCameraFacingModeSelectOptions(dom.cameraFacingModeSelect);
    renderCameraResolutionSelectOptions(dom.cameraResolutionSelect);
    syncViewportCaptureAspectRatio(
      dom.viewportElement,
      INTRINSICS_REFERENCE_WIDTH_PIXELS,
      INTRINSICS_REFERENCE_HEIGHT_PIXELS,
    );
    renderDefaultCameraFrameRateSelectOptions(dom.cameraFrameRateSelect);
    dom.cameraFrameRateSelect.disabled = false;
    dom.cameraFrameRateSelect.dataset.probeComplete = "true";
  }

  function syncCameraCaptureResolutionPreview(dom: MultiCubeAppDomElements): void {
    const selectedResolution = readSelectedCameraResolution(dom.cameraResolutionSelect);
    syncViewportCaptureAspectRatio(
      dom.viewportElement,
      selectedResolution.widthPixels,
      selectedResolution.heightPixels,
    );
    renderDefaultCameraFrameRateSelectOptions(dom.cameraFrameRateSelect);
    dom.cameraFrameRateHintElement.textContent =
      `Resolution preview ${formatCameraResolutionLabel(selectedResolution)}. ${CAMERA_FRAME_RATE_DEFAULT_HINT_MESSAGE}`;
  }

  function initializeCameraCaptureOptions(dom: MultiCubeAppDomElements): void {
    initializeCameraCaptureControls(dom);
    renderDefaultCameraFrameRateSelectOptions(dom.cameraFrameRateSelect);
    dom.cameraFrameRateSelect.disabled = false;
    dom.cameraFrameRateSelect.dataset.probeComplete = "true";
    dom.cameraFrameRateHintElement.textContent = CAMERA_FRAME_RATE_DEFAULT_HINT_MESSAGE;
  }

  domElements.startCameraButton.addEventListener("click", () => {
    if (state.lifecycleState === "startingCamera" || state.lifecycleState === "tracking") {
      return;
    }
    void handleStartCamera();
  });

  domElements.startDetectorButton.addEventListener("click", () => {
    if (state.lifecycleState === "loadingDetector" || state.lifecycleState === "tracking") {
      return;
    }
    void handleStartDetector();
  });

  domElements.loadConfigsButton.addEventListener("click", () => {
    void handleLoadMultiCubeConfigs();
  });

  domElements.probeFrameRatesButton.addEventListener("click", () => {
    void handleProbeFrameRates();
  });

  domElements.applyCalibrationButton.addEventListener("click", handleApplyCalibrationClick);
  domElements.clearCalibrationButton.addEventListener("click", handleClearCalibrationClick);

  domElements.cornerOrderSelect.addEventListener("change", () => {
    if (state.multiCubeConfigSet !== null) {
      void handleLoadMultiCubeConfigs();
    }
  });

  domElements.overlayDisplayModeSelect.addEventListener("change", () => {
    refreshOverlayDisplayMode();
    redrawCurrentMultiCubeOverlayFrame();
    updateMultiCubeAppUi(
      domElements,
      state,
      domElements.cameraStatusElement.textContent ?? "not started",
      domElements.resolutionStatusElement.textContent ?? "not checked",
      domElements.detectorStatusElement.textContent ?? "not started",
      domElements.poseStatusElement.textContent ?? "not estimated",
    );
  });

  domElements.cameraResolutionSelect.addEventListener("change", () => {
    if (state.lifecycleState !== "idle" && state.lifecycleState !== "failed") {
      return;
    }
    syncCameraCaptureResolutionPreview(domElements);
  });

  window.addEventListener("pagehide", () => {
    stopMultiCubeTrackingLoop(state);
    stopCameraStream(state.mediaStream);
    resetCachedKiboTagDetector();
  });

  initializeCameraCaptureControls(domElements);
  initializeCameraCaptureOptions(domElements);
  refreshOverlayDisplayMode();

  updateMultiCubeAppUi(domElements, state, "not started", "not checked", "not started", "not estimated");

  // Auto-load 16 cube configs on page open so the demo is ready to start camera + detector.
  void handleLoadMultiCubeConfigs();
}

bindMultiCubeApplication();
