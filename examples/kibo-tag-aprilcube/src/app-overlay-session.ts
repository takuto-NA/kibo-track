/**
 * Overlay draw-input assembly and viewport display mode for the demo session.
 */
import type { DetectedMarkerCorners, Pose } from "kibo-track";
import {
  buildAprilCubeConfigFromLayoutJson,
  EXAMPLE_APRILCUBE_LAYOUT_JSON,
} from "./aprilcube-config.js";
import type { AppDomElements, AppRuntimeState } from "./app-runtime.js";
import {
  readOverlayDisplayModeFromSelectValue,
  shouldUseOverlayOnlyBackground,
} from "./overlay-display-mode.js";
import { drawOverlay, type OverlayDrawInput } from "./overlay.js";
import { readCornerOrderFromSelectValue } from "./read-corner-order-selection.js";
import {
  createThreeModelOverlay,
  disposeThreeModelOverlay,
  renderThreeModelOverlay,
  shouldDrawThreeModelOverlay,
  type ThreeModelOverlayRenderInput,
  type ThreeModelOverlaySession,
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

function ensureThreeModelOverlaySession(
  domElements: AppDomElements,
  state: AppRuntimeState,
  cubeSizeMeters: number,
): ThreeModelOverlaySession {
  if (state.threeModelOverlaySession !== null) {
    return state.threeModelOverlaySession;
  }

  const threeModelOverlaySession = createThreeModelOverlay(
    domElements.threeModelCanvas,
    cubeSizeMeters,
  );
  state.threeModelOverlaySession = threeModelOverlaySession;
  return threeModelOverlaySession;
}

function buildThreeModelOverlayRenderInput(
  domElements: AppDomElements,
  state: AppRuntimeState,
  pose: Pose | null,
  cubeSizeMeters: number,
): ThreeModelOverlayRenderInput {
  return {
    overlayDisplayMode: state.overlayDisplayMode,
    cameraFromObjectPose: pose,
    cameraIntrinsics: state.scaledCameraIntrinsics,
    captureCanvas: domElements.captureCanvas,
    cubeSizeMeters,
  };
}

/** Builds overlay draw input from the current demo session state. */
export function buildOverlayDrawInput(
  domElements: AppDomElements,
  state: AppRuntimeState,
  detectedMarkers: ReadonlyArray<DetectedMarkerCorners>,
  pose: Pose | null,
  cubeSizeMeters: number,
): OverlayDrawInput {
  state.overlayDisplayMode = readOverlayDisplayMode(domElements.overlayDisplayModeSelect);
  syncViewportOverlayDisplayMode(domElements.viewportElement, state.overlayDisplayMode);

  return {
    overlayCanvas: domElements.overlayCanvas,
    captureCanvas: domElements.captureCanvas,
    detectedMarkers,
    pose,
    cubeSizeMeters,
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
  cubeSizeMeters: number,
): void {
  if (state.scaledCameraIntrinsics === null) {
    return;
  }

  const renderInput = buildThreeModelOverlayRenderInput(
    domElements,
    state,
    pose,
    cubeSizeMeters,
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

  const threeModelOverlaySession = ensureThreeModelOverlaySession(
    domElements,
    state,
    cubeSizeMeters,
  );

  renderThreeModelOverlay(threeModelOverlaySession, domElements.threeModelCanvas, renderInput);
}

/** Draws the 2D overlay and synchronizes the three.js model overlay. */
export function renderOverlayFrames(
  domElements: AppDomElements,
  state: AppRuntimeState,
  detectedMarkers: ReadonlyArray<DetectedMarkerCorners>,
  pose: Pose | null,
  cubeSizeMeters: number,
): void {
  if (state.scaledCameraIntrinsics === null) {
    return;
  }

  drawOverlay(
    buildOverlayDrawInput(domElements, state, detectedMarkers, pose, cubeSizeMeters),
  );
  renderThreeModelOverlayFrame(domElements, state, pose, cubeSizeMeters);
}

/** Disposes the three.js overlay session and releases GPU resources. */
export function disposeAppThreeModelOverlaySession(state: AppRuntimeState): void {
  if (state.threeModelOverlaySession === null) {
    return;
  }

  disposeThreeModelOverlay(state.threeModelOverlaySession);
  state.threeModelOverlaySession = null;
}

/** Redraws the overlay from the latest tracked pose and detected markers. */
export function redrawCurrentOverlayFrame(
  domElements: AppDomElements,
  state: AppRuntimeState,
): void {
  if (state.scaledCameraIntrinsics === null) {
    return;
  }

  const aprilCubeConfig = buildAprilCubeConfigFromLayoutJson(
    EXAMPLE_APRILCUBE_LAYOUT_JSON,
    readCornerOrderFromSelectValue(domElements.cornerOrderSelect.value),
  );

  renderOverlayFrames(
    domElements,
    state,
    state.detectedMarkers,
    state.trackedPose,
    aprilCubeConfig.cubeSize,
  );
}
