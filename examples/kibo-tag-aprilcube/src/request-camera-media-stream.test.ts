/**
 * Unit tests for mobile-friendly camera stream opening fallbacks.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestCameraMediaStream } from "./request-camera-media-stream.js";

function createMockMediaStream(facingMode: string): MediaStream {
  const videoTrack = {
    getSettings: () => ({ facingMode }),
    stop: vi.fn(),
  };
  const mediaStream = new MediaStream();

  Object.defineProperty(mediaStream, "getVideoTracks", {
    value: () => [videoTrack],
  });
  Object.defineProperty(mediaStream, "getTracks", {
    value: () => [videoTrack],
  });

  return mediaStream;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("requestCameraMediaStream", () => {
  it("retries when the first stream opens the wrong facing mode", async () => {
    vi.stubGlobal("isSecureContext", true);

    const frontCameraStream = createMockMediaStream("user");
    const backCameraStream = createMockMediaStream("environment");
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(frontCameraStream)
      .mockResolvedValueOnce(backCameraStream);

    vi.stubGlobal("navigator", {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        getUserMedia,
      },
    });

    const mediaStream = await requestCameraMediaStream({
      facingModeSelection: "environment",
      frameRateSelection: "deviceDefault",
      resolution: { widthPixels: 1280, heightPixels: 720 },
    });

    expect(mediaStream).toBe(backCameraStream);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it("uses plain facingMode string on the first attempt", async () => {
    vi.stubGlobal("isSecureContext", true);

    const backCameraStream = createMockMediaStream("environment");
    const getUserMedia = vi.fn().mockResolvedValue(backCameraStream);

    vi.stubGlobal("navigator", {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        getUserMedia,
      },
    });

    await requestCameraMediaStream({
      facingModeSelection: "environment",
      frameRateSelection: "deviceDefault",
      resolution: { widthPixels: 1280, heightPixels: 720 },
    });

    expect(getUserMedia).toHaveBeenCalledWith({
      video: expect.objectContaining({
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      }),
      audio: false,
    });
  });
});
