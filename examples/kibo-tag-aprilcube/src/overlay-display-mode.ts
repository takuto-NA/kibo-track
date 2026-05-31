/**
 * Overlay display mode parsing and visibility predicates for 2D/3D layers.
 */
import type { OverlayDisplayMode } from "./types.js";

/** Default overlay mode: camera feed with 2D wireframe. */
export const DEFAULT_OVERLAY_DISPLAY_MODE: OverlayDisplayMode = "cameraWithWireframe";

const OVERLAY_DISPLAY_MODE_VALUES: readonly OverlayDisplayMode[] = [
  "cameraWithWireframe",
  "wireframeOnly",
  "cameraWithModel",
  "modelOnly",
];

function isOverlayDisplayMode(value: string): value is OverlayDisplayMode {
  return OVERLAY_DISPLAY_MODE_VALUES.some((candidate) => candidate === value);
}

/** Reads overlay display mode from a select element value. */
export function readOverlayDisplayModeFromSelectValue(selectValue: string): OverlayDisplayMode {
  if (isOverlayDisplayMode(selectValue)) {
    return selectValue;
  }

  return DEFAULT_OVERLAY_DISPLAY_MODE;
}

/** Populates the overlay display mode select with default options. */
export function renderOverlayDisplayModeSelectOptions(
  overlayDisplayModeSelect: HTMLSelectElement,
): void {
  overlayDisplayModeSelect.replaceChildren();

  const options: ReadonlyArray<{ readonly value: OverlayDisplayMode; readonly label: string }> = [
    { value: "cameraWithWireframe", label: "Camera + wireframe" },
    { value: "wireframeOnly", label: "Wireframe only" },
    { value: "cameraWithModel", label: "Camera + 3D model" },
    { value: "modelOnly", label: "3D model only" },
  ];

  for (const optionDefinition of options) {
    const optionElement = document.createElement("option");
    optionElement.value = optionDefinition.value;
    optionElement.textContent = optionDefinition.label;
    overlayDisplayModeSelect.appendChild(optionElement);
  }

  overlayDisplayModeSelect.value = DEFAULT_OVERLAY_DISPLAY_MODE;
}

/** Returns true when the live camera feed should be composited. */
export function shouldShowCameraFeed(overlayDisplayMode: OverlayDisplayMode): boolean {
  return (
    overlayDisplayMode === "cameraWithWireframe" || overlayDisplayMode === "cameraWithModel"
  );
}

/** Returns true when detected marker outlines should be drawn on the 2D overlay. */
export function shouldShowMarkerOutlines(overlayDisplayMode: OverlayDisplayMode): boolean {
  return shouldShowCameraFeed(overlayDisplayMode);
}

/** Returns true when the 2D cube wireframe and pose axes should be drawn. */
export function shouldShowWireframeOverlay(overlayDisplayMode: OverlayDisplayMode): boolean {
  return (
    overlayDisplayMode === "cameraWithWireframe" || overlayDisplayMode === "wireframeOnly"
  );
}

/** Returns true when the three.js model layer should be rendered. */
export function shouldShowThreeModelOverlay(overlayDisplayMode: OverlayDisplayMode): boolean {
  return overlayDisplayMode === "cameraWithModel" || overlayDisplayMode === "modelOnly";
}

/** Returns true when the viewport should use the wireframe-only dark background. */
export function shouldUseOverlayOnlyBackground(overlayDisplayMode: OverlayDisplayMode): boolean {
  return overlayDisplayMode === "wireframeOnly" || overlayDisplayMode === "modelOnly";
}

/** Returns true when a tracked pose is required to show any overlay content. */
export function shouldRenderThreeModelForPose(
  overlayDisplayMode: OverlayDisplayMode,
  poseIsAvailable: boolean,
): boolean {
  if (!shouldShowThreeModelOverlay(overlayDisplayMode)) {
    return false;
  }

  return poseIsAvailable;
}
