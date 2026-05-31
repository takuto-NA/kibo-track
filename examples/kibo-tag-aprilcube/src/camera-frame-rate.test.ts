/**
 * Unit tests for camera frame-rate constraint helpers.
 */
import { describe, expect, it, vi } from "vitest";
import {
  CAMERA_FRAME_RATE_30_FPS,
  CAMERA_FRAME_RATE_60_FPS,
  INTRINSICS_REFERENCE_HEIGHT_PIXELS,
  INTRINSICS_REFERENCE_WIDTH_PIXELS,
} from "./constants.js";
import {
  buildCameraFrameRateConstraint,
  buildCameraVideoConstraints,
  filterSupportedCameraFrameRateCandidates,
  formatCameraFrameRateProbeMessage,
  isRequestedFrameRateUnsupported,
  negotiateCameraFrameRate,
  readSelectedCameraFrameRateSelection,
  renderCameraFrameRateSelectOptions,
} from "./camera-frame-rate.js";

const REFERENCE_RESOLUTION = {
  widthPixels: INTRINSICS_REFERENCE_WIDTH_PIXELS,
  heightPixels: INTRINSICS_REFERENCE_HEIGHT_PIXELS,
};

const VGA_RESOLUTION = {
  widthPixels: 640,
  heightPixels: 480,
};

describe("camera frame-rate helpers", () => {
  it("omits frameRate for device default selection", () => {
    expect(buildCameraFrameRateConstraint("deviceDefault")).toBeUndefined();
    expect(
      buildCameraVideoConstraints({
        resolution: REFERENCE_RESOLUTION,
        frameRateSelection: "deviceDefault",
      }).frameRate,
    ).toBeUndefined();
  });

  it("requests an exact 30 fps band when selected", () => {
    expect(buildCameraFrameRateConstraint("30")).toEqual({
      min: CAMERA_FRAME_RATE_30_FPS,
      ideal: CAMERA_FRAME_RATE_30_FPS,
      max: CAMERA_FRAME_RATE_30_FPS,
    });
  });

  it("requests an exact 60 fps band when selected", () => {
    expect(buildCameraFrameRateConstraint("60")).toEqual({
      min: CAMERA_FRAME_RATE_60_FPS,
      ideal: CAMERA_FRAME_RATE_60_FPS,
      max: CAMERA_FRAME_RATE_60_FPS,
    });
  });

  it("keeps the requested resolution in video constraints", () => {
    const videoConstraints = buildCameraVideoConstraints({
      resolution: VGA_RESOLUTION,
      frameRateSelection: "30",
    });

    expect(videoConstraints.width).toEqual({ ideal: VGA_RESOLUTION.widthPixels });
    expect(videoConstraints.height).toEqual({ ideal: VGA_RESOLUTION.heightPixels });
  });

  it("falls back to device default for unknown select values", () => {
    const cameraFrameRateSelect = document.createElement("select");
    cameraFrameRateSelect.innerHTML = `<option value="invalid">invalid</option>`;
    cameraFrameRateSelect.value = "invalid";

    expect(readSelectedCameraFrameRateSelection(cameraFrameRateSelect)).toBe("deviceDefault");
  });

  it("filters candidate frame rates using probed capability bounds", () => {
    expect(filterSupportedCameraFrameRateCandidates(1, CAMERA_FRAME_RATE_30_FPS)).toEqual([
      15,
      24,
      CAMERA_FRAME_RATE_30_FPS,
    ]);
    expect(filterSupportedCameraFrameRateCandidates(1, CAMERA_FRAME_RATE_60_FPS)).toEqual([
      15,
      24,
      CAMERA_FRAME_RATE_30_FPS,
      48,
      CAMERA_FRAME_RATE_60_FPS,
    ]);
  });

  it("renders only supported candidate options in the select", () => {
    const cameraFrameRateSelect = document.createElement("select");

    renderCameraFrameRateSelectOptions(cameraFrameRateSelect, [
      CAMERA_FRAME_RATE_30_FPS,
    ]);

    expect(Array.from(cameraFrameRateSelect.options).map((option) => option.value)).toEqual([
      "deviceDefault",
      "30",
    ]);
  });

  it("formats a probe message with capability range and selectable values", () => {
    const probeMessage = formatCameraFrameRateProbeMessage(
      {
        success: true,
        capabilityMinFrameRate: 1,
        capabilityMaxFrameRate: CAMERA_FRAME_RATE_30_FPS,
        supportedCandidateFrameRates: [15, 24, CAMERA_FRAME_RATE_30_FPS],
        detail: "",
      },
      VGA_RESOLUTION,
    );

    expect(probeMessage).toContain("640×480");
    expect(probeMessage).toContain("1–30 fps");
    expect(probeMessage).toContain("15, 24, 30");
  });

  it("reports mismatch when renegotiation still leaves 30 fps for a 60 fps request", async () => {
    const mediaStream = new MediaStream();
    const applyConstraints = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(mediaStream, "getVideoTracks", {
      value: () => [
        {
          getSettings: () => ({ frameRate: CAMERA_FRAME_RATE_30_FPS }),
          getCapabilities: () => ({ frameRate: { min: 1, max: CAMERA_FRAME_RATE_30_FPS } }),
          applyConstraints,
        },
      ],
    });

    const negotiationResult = await negotiateCameraFrameRate(mediaStream, "60");

    expect(applyConstraints).toHaveBeenCalledWith({
      frameRate: buildCameraFrameRateConstraint("60"),
    });
    expect(negotiationResult.actualFrameRate).toBe(CAMERA_FRAME_RATE_30_FPS);
    expect(negotiationResult.capabilityMaxFrameRate).toBe(CAMERA_FRAME_RATE_30_FPS);
    expect(negotiationResult.frameRateMismatch).toBe(true);
    expect(isRequestedFrameRateUnsupported("60", negotiationResult.capabilityMaxFrameRate)).toBe(
      true,
    );
  });
});
