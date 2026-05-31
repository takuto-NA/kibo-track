/**
 * Application entrypoint: binds DOM events for the AprilCube demo.
 */
import { stopCameraStream } from "./camera-startup.js";
import {
  createInitialAppRuntimeState,
  readAppDomElements,
} from "./app-runtime.js";
import {
  handleApplyCalibration,
  handleClearCalibration,
  handleProbeCameraFrameRates,
  handleStartCamera,
  handleStartDetector,
  initializeCameraCaptureOptions,
  syncCameraCaptureResolutionPreview,
} from "./app-handlers.js";
import { redrawCurrentOverlayFrame, disposeAppThreeModelOverlaySession } from "./app-overlay-session.js";
import { renderOverlayDisplayModeSelectOptions } from "./overlay-display-mode.js";
import { stopAppTrackingLoop } from "./app-tracking-loop.js";
import { updateAppUi } from "./app-ui-text.js";

function bindApplication(): void {
  const domElements = readAppDomElements();
  const state = createInitialAppRuntimeState();

  domElements.startCameraButton.addEventListener("click", () => {
    if (state.lifecycleState === "startingCamera" || state.lifecycleState === "tracking") {
      return;
    }

    void handleStartCamera(domElements, state);
  });

  domElements.startDetectorButton.addEventListener("click", () => {
    if (state.lifecycleState === "loadingDetector" || state.lifecycleState === "tracking") {
      return;
    }

    void handleStartDetector(domElements, state);
  });

  domElements.probeFrameRatesButton.addEventListener("click", () => {
    if (state.lifecycleState !== "idle" && state.lifecycleState !== "failed") {
      return;
    }

    void handleProbeCameraFrameRates(domElements, state);
  });

  domElements.applyCalibrationButton.addEventListener("click", () => {
    handleApplyCalibration(domElements, state);
  });

  domElements.clearCalibrationButton.addEventListener("click", () => {
    handleClearCalibration(domElements, state);
  });

  domElements.overlayDisplayModeSelect.addEventListener("change", () => {
    redrawCurrentOverlayFrame(domElements, state);
    updateAppUi(
      domElements,
      state,
      domElements.cameraStatusElement.textContent ?? "not started",
      domElements.resolutionStatusElement.textContent ?? "not checked",
      domElements.detectorStatusElement.textContent ?? "not started",
      domElements.poseStatusElement.textContent ?? "not estimated",
    );
  });

  renderOverlayDisplayModeSelectOptions(domElements.overlayDisplayModeSelect);

  window.addEventListener("pagehide", () => {
    stopAppTrackingLoop(state);
    disposeAppThreeModelOverlaySession(state);
    stopCameraStream(state.mediaStream);
  });

  initializeCameraCaptureOptions(domElements);

  domElements.cameraResolutionSelect.addEventListener("change", () => {
    if (state.lifecycleState !== "idle" && state.lifecycleState !== "failed") {
      return;
    }

    syncCameraCaptureResolutionPreview(domElements);
  });

  updateAppUi(domElements, state, "not started", "not checked", "not started", "not estimated");
}

bindApplication();
