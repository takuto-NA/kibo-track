/**
 * Camera resolution presets and selection helpers for getUserMedia constraints.
 */
import {
  INTRINSICS_REFERENCE_HEIGHT_PIXELS,
  INTRINSICS_REFERENCE_WIDTH_PIXELS,
} from "./constants.js";

export interface CameraResolutionPixels {
  readonly widthPixels: number;
  readonly heightPixels: number;
}

export interface CameraResolutionPreset extends CameraResolutionPixels {
  readonly selectionValue: `${number}x${number}`;
  readonly displayLabel: string;
}

/** Default resolution; matches calibrated intrinsics reference size. */
export const DEFAULT_CAMERA_RESOLUTION_SELECTION = `${INTRINSICS_REFERENCE_WIDTH_PIXELS}x${INTRINSICS_REFERENCE_HEIGHT_PIXELS}` as const;

/** Common capture resolutions offered in the example UI. */
export const CAMERA_RESOLUTION_PRESETS: readonly CameraResolutionPreset[] = [
  {
    selectionValue: "1920x1080",
    displayLabel: "1920×1080",
    widthPixels: 1920,
    heightPixels: 1080,
  },
  {
    selectionValue: DEFAULT_CAMERA_RESOLUTION_SELECTION,
    displayLabel: "1280×720 (calibration reference)",
    widthPixels: INTRINSICS_REFERENCE_WIDTH_PIXELS,
    heightPixels: INTRINSICS_REFERENCE_HEIGHT_PIXELS,
  },
  {
    selectionValue: "960x540",
    displayLabel: "960×540",
    widthPixels: 960,
    heightPixels: 540,
  },
  {
    selectionValue: "640x480",
    displayLabel: "640×480",
    widthPixels: 640,
    heightPixels: 480,
  },
];

function findCameraResolutionPresetBySelectionValue(
  selectionValue: string,
): CameraResolutionPreset | null {
  for (const resolutionPreset of CAMERA_RESOLUTION_PRESETS) {
    if (resolutionPreset.selectionValue === selectionValue) {
      return resolutionPreset;
    }
  }

  return null;
}

/** Parses a "widthxheight" select value into pixel dimensions. */
export function parseCameraResolutionSelection(
  selectionValue: string,
): CameraResolutionPixels | null {
  const resolutionPreset = findCameraResolutionPresetBySelectionValue(selectionValue);

  if (resolutionPreset !== null) {
    return {
      widthPixels: resolutionPreset.widthPixels,
      heightPixels: resolutionPreset.heightPixels,
    };
  }

  const resolutionMatch = /^(\d+)x(\d+)$/.exec(selectionValue);

  if (resolutionMatch === null) {
    return null;
  }

  const widthPixels = Number(resolutionMatch[1]);
  const heightPixels = Number(resolutionMatch[2]);

  if (!Number.isFinite(widthPixels) || !Number.isFinite(heightPixels)) {
    return null;
  }

  if (widthPixels <= 0 || heightPixels <= 0) {
    return null;
  }

  return { widthPixels, heightPixels };
}

/** Reads the selected resolution from the controls UI, falling back to the default preset. */
export function readSelectedCameraResolution(
  cameraResolutionSelect: HTMLSelectElement,
): CameraResolutionPixels {
  const parsedResolution = parseCameraResolutionSelection(cameraResolutionSelect.value);

  if (parsedResolution !== null) {
    return parsedResolution;
  }

  const defaultResolutionPreset = findCameraResolutionPresetBySelectionValue(
    DEFAULT_CAMERA_RESOLUTION_SELECTION,
  );

  if (defaultResolutionPreset === null) {
    return {
      widthPixels: INTRINSICS_REFERENCE_WIDTH_PIXELS,
      heightPixels: INTRINSICS_REFERENCE_HEIGHT_PIXELS,
    };
  }

  return {
    widthPixels: defaultResolutionPreset.widthPixels,
    heightPixels: defaultResolutionPreset.heightPixels,
  };
}

/** Populates the resolution select from known presets. */
export function renderCameraResolutionSelectOptions(
  cameraResolutionSelect: HTMLSelectElement,
): void {
  cameraResolutionSelect.replaceChildren();

  for (const resolutionPreset of CAMERA_RESOLUTION_PRESETS) {
    const resolutionOption = document.createElement("option");
    resolutionOption.value = resolutionPreset.selectionValue;
    resolutionOption.textContent = resolutionPreset.displayLabel;
    cameraResolutionSelect.appendChild(resolutionOption);
  }

  cameraResolutionSelect.value = DEFAULT_CAMERA_RESOLUTION_SELECTION;
}

/** Formats pixel dimensions for status and diagnostics lines. */
export function formatCameraResolutionLabel(resolution: CameraResolutionPixels): string {
  return `${resolution.widthPixels}×${resolution.heightPixels}`;
}

/** Returns true when negotiated capture size differs from the requested preset. */
export function cameraResolutionMatchesRequest(
  requestedResolution: CameraResolutionPixels,
  actualWidthPixels: number,
  actualHeightPixels: number,
): boolean {
  return (
    requestedResolution.widthPixels === actualWidthPixels &&
    requestedResolution.heightPixels === actualHeightPixels
  );
}
