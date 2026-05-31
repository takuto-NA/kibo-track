/**
 * Overlay draw-input assembly and viewport display mode for the demo session.
 */
import type { DetectedMarkerCorners, Pose } from "kibo-track";
import {
  buildAprilCubeConfigFromLayoutJson,
  EXAMPLE_APRILCUBE_LAYOUT_JSON,
} from "./aprilcube-config.js";
import type { AppDomElements, AppRuntimeState } from "./app-runtime.js";
import { drawOverlay, type OverlayDrawInput } from "./overlay.js";
import { readCornerOrderFromSelectValue } from "./read-corner-order-selection.js";
import type { OverlayDisplayMode } from "./types.js";

function readOverlayDisplayMode(wireframeOnlyCheckbox: HTMLInputElement): OverlayDisplayMode {
  if (wireframeOnlyCheckbox.checked) {
    return "wireframeOnly";
  }

  return "cameraWithOverlay";
}

function syncViewportOverlayDisplayMode(
  viewportElement: HTMLElement,
  overlayDisplayMode: OverlayDisplayMode,
): void {
  viewportElement.classList.toggle(
    "viewport-wireframe-only",
    overlayDisplayMode === "wireframeOnly",
  );
}

/** Builds overlay draw input from the current demo session state. */
export function buildOverlayDrawInput(
  domElements: AppDomElements,
  state: AppRuntimeState,
  detectedMarkers: ReadonlyArray<DetectedMarkerCorners>,
  pose: Pose | null,
  cubeSizeMeters: number,
): OverlayDrawInput {
  state.overlayDisplayMode = readOverlayDisplayMode(domElements.wireframeOnlyCheckbox);
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

  drawOverlay(
    buildOverlayDrawInput(
      domElements,
      state,
      state.detectedMarkers,
      state.trackedPose,
      aprilCubeConfig.cubeSize,
    ),
  );
}
