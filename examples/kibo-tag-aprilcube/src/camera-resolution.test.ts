/**
 * Unit tests for camera resolution selection helpers.
 */
import { describe, expect, it } from "vitest";
import {
  CAMERA_RESOLUTION_PRESETS,
  cameraResolutionMatchesRequest,
  DEFAULT_CAMERA_RESOLUTION_SELECTION,
  parseCameraResolutionSelection,
  readSelectedCameraResolution,
  renderCameraResolutionSelectOptions,
} from "./camera-resolution.js";

describe("camera resolution helpers", () => {
  it("parses preset selection values", () => {
    expect(parseCameraResolutionSelection("640x480")).toEqual({
      widthPixels: 640,
      heightPixels: 480,
    });
  });

  it("falls back to the default preset for invalid select values", () => {
    const cameraResolutionSelect = document.createElement("select");
    cameraResolutionSelect.innerHTML = `<option value="invalid">invalid</option>`;
    cameraResolutionSelect.value = "invalid";

    expect(readSelectedCameraResolution(cameraResolutionSelect)).toEqual({
      widthPixels: 1280,
      heightPixels: 720,
    });
  });

  it("renders all known presets in the select", () => {
    const cameraResolutionSelect = document.createElement("select");

    renderCameraResolutionSelectOptions(cameraResolutionSelect);

    expect(cameraResolutionSelect.value).toBe(DEFAULT_CAMERA_RESOLUTION_SELECTION);
    expect(Array.from(cameraResolutionSelect.options).map((option) => option.value)).toEqual(
      CAMERA_RESOLUTION_PRESETS.map((resolutionPreset) => resolutionPreset.selectionValue),
    );
  });

  it("detects when negotiated capture size differs from the request", () => {
    expect(
      cameraResolutionMatchesRequest({ widthPixels: 1280, heightPixels: 720 }, 1280, 720),
    ).toBe(true);
    expect(
      cameraResolutionMatchesRequest({ widthPixels: 1280, heightPixels: 720 }, 640, 480),
    ).toBe(false);
  });
});
