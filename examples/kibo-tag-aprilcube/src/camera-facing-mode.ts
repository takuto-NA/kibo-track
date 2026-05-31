/**
 * Camera facing-mode selection helpers for getUserMedia constraints.
 */
import type { CameraFacingModeSelection } from "./types.js";
export const DEFAULT_CAMERA_FACING_MODE_SELECTION: CameraFacingModeSelection = "environment";

export interface CameraFacingModeOption {
  readonly selectionValue: CameraFacingModeSelection;
  readonly displayLabel: string;
}

/** Facing-mode choices shown in the demo UI. */
export const CAMERA_FACING_MODE_OPTIONS: readonly CameraFacingModeOption[] = [
  {
    selectionValue: "environment",
    displayLabel: "Back (environment)",
  },
  {
    selectionValue: "user",
    displayLabel: "Front (user)",
  },
];

/** Matches rear-camera labels returned by enumerateDevices on mobile browsers. */
const BACK_CAMERA_DEVICE_LABEL_PATTERN =
  /back|rear|environment|trase|trasera|背面|後/i;

/** Matches front-camera labels returned by enumerateDevices on mobile browsers. */
const FRONT_CAMERA_DEVICE_LABEL_PATTERN =
  /front|user|selfie|face|前面|イン/i;

/** Reads the selected facing mode from the controls UI. */
export function readSelectedCameraFacingModeSelection(
  cameraFacingModeSelect: HTMLSelectElement,
): CameraFacingModeSelection {
  const selectedValue = cameraFacingModeSelect.value;

  if (selectedValue === "environment" || selectedValue === "user") {
    return selectedValue;
  }

  return DEFAULT_CAMERA_FACING_MODE_SELECTION;
}

/**
 * Builds facingMode constraints for getUserMedia.
 * Plain strings are more reliable on iOS Safari than `{ ideal: ... }`.
 */
export function buildCameraFacingModeConstraint(
  facingModeSelection: CameraFacingModeSelection,
): ConstrainDOMString {
  return facingModeSelection;
}

/** Builds a mandatory facingMode constraint (rear/front must match). */
export function buildCameraFacingModeExactConstraint(
  facingModeSelection: CameraFacingModeSelection,
): ConstrainDOMString {
  return { exact: facingModeSelection };
}

function parseCameraFacingModeSelection(
  facingModeValue: string,
): CameraFacingModeSelection | null {
  if (facingModeValue === "environment" || facingModeValue === "user") {
    return facingModeValue;
  }

  return null;
}

/** Reads the negotiated facing mode from an active video track, if reported. */
export function readNegotiatedCameraFacingMode(
  mediaStream: MediaStream,
): CameraFacingModeSelection | null {
  const videoTrack = mediaStream.getVideoTracks()[0];

  if (videoTrack === undefined) {
    return null;
  }

  const facingMode = videoTrack.getSettings().facingMode;

  if (facingMode === undefined || facingMode.length === 0) {
    return null;
  }

  return parseCameraFacingModeSelection(facingMode);
}

/** Returns true when the opened stream matches the requested facing direction. */
export function isNegotiatedCameraFacingModeAcceptable(
  mediaStream: MediaStream,
  requestedFacingModeSelection: CameraFacingModeSelection,
): boolean {
  const negotiatedFacingMode = readNegotiatedCameraFacingMode(mediaStream);

  if (negotiatedFacingMode === null) {
    return true;
  }

  return negotiatedFacingMode === requestedFacingModeSelection;
}

function deviceLabelMatchesFacingMode(
  deviceLabel: string,
  facingModeSelection: CameraFacingModeSelection,
): boolean {
  if (facingModeSelection === "environment") {
    return BACK_CAMERA_DEVICE_LABEL_PATTERN.test(deviceLabel);
  }

  return FRONT_CAMERA_DEVICE_LABEL_PATTERN.test(deviceLabel);
}

/** Finds a video-input deviceId for the requested facing direction, if labeled. */
export function findVideoInputDeviceIdForFacingMode(
  mediaDevices: readonly MediaDeviceInfo[],
  facingModeSelection: CameraFacingModeSelection,
): string | null {
  for (const mediaDevice of mediaDevices) {
    if (mediaDevice.kind !== "videoinput") {
      continue;
    }

    const deviceId = mediaDevice.deviceId;

    if (deviceId === undefined || deviceId.length === 0) {
      continue;
    }

    const deviceLabel = mediaDevice.label ?? "";

    if (deviceLabel.length === 0) {
      continue;
    }

    if (deviceLabelMatchesFacingMode(deviceLabel, facingModeSelection)) {
      return deviceId;
    }
  }

  return null;
}

/** Populates the facing-mode select with default options. */
export function renderCameraFacingModeSelectOptions(
  cameraFacingModeSelect: HTMLSelectElement,
): void {
  cameraFacingModeSelect.replaceChildren();

  for (const facingModeOption of CAMERA_FACING_MODE_OPTIONS) {
    const optionElement = document.createElement("option");
    optionElement.value = facingModeOption.selectionValue;
    optionElement.textContent = facingModeOption.displayLabel;
    cameraFacingModeSelect.appendChild(optionElement);
  }

  cameraFacingModeSelect.value = DEFAULT_CAMERA_FACING_MODE_SELECTION;
}
