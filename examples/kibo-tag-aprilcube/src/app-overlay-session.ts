/**
 * Overlay draw-input assembly and viewport display mode for the demo session.
 */
import type { DetectedMarkerCorners, Pose } from "kibo-track";
import type { AppDomElements, AppRuntimeState } from "./app-runtime.js";
import { computeMaxBoxDimensionMeters } from "./loaded-aprilcube-model-config.js";
import {
  readOverlayDisplayModeFromSelectValue,
  shouldUseOverlayOnlyBackground,
} from "./overlay-display-mode.js";
import { drawOverlay, type OverlayDrawInput } from "./overlay.js";
import {
  createThreeModelOverlay,
  disposeThreeModelOverlay,
  renderThreeModelOverlay,
  shouldDrawThreeModelOverlay,
  type ThreeModelOverlayRenderInput,
} from "./three-model-overlay.js";
import type { OverlayDisplayMode } from "./types.js";

function readOverlayDisplayMode(overlayDisplayModeSelect: HTMLSelectElement): OverlayDisplayMode {
  return readOverlayDisplayModeFromSelectValue(overlayDisplayModeSelect.value);
}

function syncViewportOverlayDisplayMode(
  viewportElement: HTMLElement,
  overlayDisplayMode: OverlayDisplayMode,
): void {
  viewportElement.classList.toggle(
    "viewport-overlay-only-background",
    shouldUseOverlayOnlyBackground(overlayDisplayMode),
  );
}

function startThreeModelOverlayLoadIfNeeded(
  domElements: AppDomElements,
  state: AppRuntimeState,
  referenceDimensionMeters: number,
): void {
  if (state.threeModelOverlaySession !== null || state.threeModelOverlayLoadPromise !== null) {
    return;
  }

  // Guard: do not retry every frame after a failed load until the page reloads.
  if (state.threeModelOverlayLoadError !== null) {
    return;
  }

  state.threeModelOverlayLoadPromise = createThreeModelOverlay(
    domElements.threeModelCanvas,
    referenceDimensionMeters,
  )
    .then((threeModelOverlaySession) => {
      state.threeModelOverlaySession = threeModelOverlaySession;
      state.threeModelOverlayLoadPromise = null;
      state.threeModelOverlayLoadError = null;
      return threeModelOverlaySession;
    })
    .catch((error: unknown) => {
      state.threeModelOverlayLoadPromise = null;
      state.threeModelOverlayLoadError =
        error instanceof Error ? error.message : "three.js model load failed";
      return null;
    });
}

function buildThreeModelOverlayRenderInput(
  domElements: AppDomElements,
  state: AppRuntimeState,
  pose: Pose | null,
  referenceDimensionMeters: number,
): ThreeModelOverlayRenderInput {
  return {
    overlayDisplayMode: state.overlayDisplayMode,
    cameraFromObjectPose: pose,
    cameraIntrinsics: state.scaledCameraIntrinsics,
    captureCanvas: domElements.captureCanvas,
    cubeSizeMeters: referenceDimensionMeters,
  };
}

/** Builds overlay draw input from the current demo session state. */
export function buildOverlayDrawInput(
  domElements: AppDomElements,
  state: AppRuntimeState,
  detectedMarkers: ReadonlyArray<DetectedMarkerCorners>,
  pose: Pose | null,
): OverlayDrawInput {
  state.overlayDisplayMode = readOverlayDisplayMode(domElements.overlayDisplayModeSelect);
  syncViewportOverlayDisplayMode(domElements.viewportElement, state.overlayDisplayMode);

  const loadedConfig = state.loadedAprilCubeModelConfig;

  return {
    overlayCanvas: domElements.overlayCanvas,
    captureCanvas: domElements.captureCanvas,
    detectedMarkers,
    pose,
    boxDimensionsMeters: loadedConfig.boxDimensionsMeters,
    cameraIntrinsics: state.scaledCameraIntrinsics!,
    distortionCoefficients: state.distortionCoefficients,
    overlayDisplayMode: state.overlayDisplayMode,
  };
}

/** Renders the three.js model overlay when the current display mode requires it. */
export function renderThreeModelOverlayFrame(
  domElements: AppDomElements,
  state: AppRuntimeState,
  pose: Pose | null,
): void {
  if (state.scaledCameraIntrinsics === null) {
    return;
  }

  const referenceDimensionMeters = computeMaxBoxDimensionMeters(
    state.loadedAprilCubeModelConfig.boxDimensionsMeters,
  );
  const renderInput = buildThreeModelOverlayRenderInput(
    domElements,
    state,
    pose,
    referenceDimensionMeters,
  );

  if (!shouldDrawThreeModelOverlay(renderInput)) {
    if (state.threeModelOverlaySession !== null) {
      renderThreeModelOverlay(
        state.threeModelOverlaySession,
        domElements.threeModelCanvas,
        renderInput,
      );
    }

    return;
  }

  if (state.threeModelOverlaySession === null) {
    startThreeModelOverlayLoadIfNeeded(domElements, state, referenceDimensionMeters);
    return;
  }

  renderThreeModelOverlay(
    state.threeModelOverlaySession,
    domElements.threeModelCanvas,
    renderInput,
  );
}

/** Draws the 2D overlay and synchronizes the three.js model overlay. */
export function renderOverlayFrames(
  domElements: AppDomElements,
  state: AppRuntimeState,
  detectedMarkers: ReadonlyArray<DetectedMarkerCorners>,
  pose: Pose | null,
): void {
  if (state.scaledCameraIntrinsics === null) {
    return;
  }

  drawOverlay(buildOverlayDrawInput(domElements, state, detectedMarkers, pose));
  renderThreeModelOverlayFrame(domElements, state, pose);

  if (
    state.threeModelOverlaySession === null &&
    state.threeModelOverlayLoadPromise !== null
  ) {
    void state.threeModelOverlayLoadPromise
      .then(() => {
        renderThreeModelOverlayFrame(domElements, state, pose);
      })
      .catch(() => {
        // Load error is stored on state for diagnostics/UI follow-up.
      });
  }
}

/** Disposes the three.js overlay session and releases GPU resources. */
export function disposeAppThreeModelOverlaySession(state: AppRuntimeState): void {
  if (state.threeModelOverlaySession === null) {
    return;
  }

  disposeThreeModelOverlay(state.threeModelOverlaySession);
  state.threeModelOverlaySession = null;
  state.threeModelOverlayLoadPromise = null;
  state.threeModelOverlayLoadError = null;
}

/** Redraws the overlay from the latest tracked pose and detected markers. */
export function redrawCurrentOverlayFrame(
  domElements: AppDomElements,
  state: AppRuntimeState,
): void {
  if (state.scaledCameraIntrinsics === null) {
    return;
  }

  renderOverlayFrames(
    domElements,
    state,
    state.detectedMarkers,
    state.trackedPose,
  );
}
