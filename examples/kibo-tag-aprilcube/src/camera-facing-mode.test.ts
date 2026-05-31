/**
 * Unit tests for camera facing-mode selection helpers.
 */
import { describe, expect, it } from "vitest";
import {
  buildCameraFacingModeConstraint,
  buildCameraFacingModeExactConstraint,
  DEFAULT_CAMERA_FACING_MODE_SELECTION,
  findVideoInputDeviceIdForFacingMode,
  isNegotiatedCameraFacingModeAcceptable,
  readSelectedCameraFacingModeSelection,
  renderCameraFacingModeSelectOptions,
} from "./camera-facing-mode.js";

describe("camera facing-mode helpers", () => {
  it("defaults to back camera for tag tracking", () => {
    expect(DEFAULT_CAMERA_FACING_MODE_SELECTION).toBe("environment");
  });

  it("builds plain-string facingMode constraints for iOS Safari", () => {
    expect(buildCameraFacingModeConstraint("environment")).toBe("environment");
    expect(buildCameraFacingModeConstraint("user")).toBe("user");
  });

  it("builds exact facingMode constraints", () => {
    expect(buildCameraFacingModeExactConstraint("environment")).toEqual({
      exact: "environment",
    });
  });

  it("finds a labeled back camera deviceId", () => {
    const deviceId = findVideoInputDeviceIdForFacingMode(
      [
        {
          deviceId: "front-camera-id",
          kind: "videoinput",
          label: "Front Camera",
          groupId: "group-a",
          toJSON: () => ({}),
        },
        {
          deviceId: "back-camera-id",
          kind: "videoinput",
          label: "Back Camera",
          groupId: "group-b",
          toJSON: () => ({}),
        },
      ],
      "environment",
    );

    expect(deviceId).toBe("back-camera-id");
  });

  it("rejects a stream when Safari opens the wrong facing mode", () => {
    const mediaStream = new MediaStream();
    Object.defineProperty(mediaStream, "getVideoTracks", {
      value: () => [
        {
          getSettings: () => ({ facingMode: "user" }),
        },
      ],
    });

    expect(isNegotiatedCameraFacingModeAcceptable(mediaStream, "environment")).toBe(false);
  });

  it("falls back to environment for unknown select values", () => {
    const cameraFacingModeSelect = document.createElement("select");
    cameraFacingModeSelect.innerHTML = `<option value="invalid">invalid</option>`;
    cameraFacingModeSelect.value = "invalid";

    expect(readSelectedCameraFacingModeSelection(cameraFacingModeSelect)).toBe("environment");
  });

  it("renders back and front options with back selected by default", () => {
    const cameraFacingModeSelect = document.createElement("select");

    renderCameraFacingModeSelectOptions(cameraFacingModeSelect);

    expect(cameraFacingModeSelect.value).toBe("environment");
    expect(Array.from(cameraFacingModeSelect.options).map((option) => option.value)).toEqual([
      "environment",
      "user",
    ]);
  });
});
