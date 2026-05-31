/**
 * Unit tests for camera startup gate behavior.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { CAMERA_FRAME_RATE_30_FPS } from "./constants.js";
import { startCamera } from "./camera-startup.js";

const DEFAULT_START_CAMERA_OPTIONS = {
  frameRateSelection: "deviceDefault" as const,
  resolution: {
    widthPixels: 1280,
    heightPixels: 720,
  },
};

function createMockVideoElement(): HTMLVideoElement {
  const videoElement = document.createElement("video");

  Object.defineProperty(videoElement, "videoWidth", {
    configurable: true,
    get: () => 640,
  });
  Object.defineProperty(videoElement, "videoHeight", {
    configurable: true,
    get: () => 480,
  });

  videoElement.play = vi.fn().mockResolvedValue(undefined);
  videoElement.addEventListener = vi.fn((eventName, listener) => {
    if (eventName === "loadedmetadata") {
      queueMicrotask(() => {
        if (typeof listener === "function") {
          listener(new Event("loadedmetadata"));
        }
      });
    }
  }) as HTMLVideoElement["addEventListener"];

  return videoElement;
}

function createCaptureCanvasWithVisiblePixels(): HTMLCanvasElement {
  const captureCanvas = document.createElement("canvas");
  captureCanvas.getContext = vi.fn(() => ({
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray([10, 10, 10, 255]),
    })),
  })) as unknown as HTMLCanvasElement["getContext"];

  return captureCanvas;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("startCamera", () => {
  it("returns insecureContext outside a secure context", async () => {
    vi.stubGlobal("isSecureContext", false);

    const result = await startCamera(
      {
        videoElement: createMockVideoElement(),
        captureCanvas: document.createElement("canvas"),
      },
      DEFAULT_START_CAMERA_OPTIONS,
    );

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.reason).toBe("insecureContext");
  });

  it("returns mediaDevicesUnavailable when getUserMedia is missing", async () => {
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", {
      mediaDevices: undefined,
    });

    const result = await startCamera(
      {
        videoElement: createMockVideoElement(),
        captureCanvas: document.createElement("canvas"),
      },
      DEFAULT_START_CAMERA_OPTIONS,
    );

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.reason).toBe("mediaDevicesUnavailable");
  });

  it("returns noVideoInput when getUserMedia reports no camera devices", async () => {
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        getUserMedia: vi.fn().mockRejectedValue(new DOMException("Not found", "NotFoundError")),
      },
    });

    const result = await startCamera(
      {
        videoElement: createMockVideoElement(),
        captureCanvas: document.createElement("canvas"),
      },
      DEFAULT_START_CAMERA_OPTIONS,
    );

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.reason).toBe("noVideoInput");
  });

  it("returns permissionDenied when getUserMedia rejects with NotAllowedError", async () => {
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([{ kind: "videoinput" }]),
        getUserMedia: vi.fn().mockRejectedValue(new DOMException("Denied", "NotAllowedError")),
      },
    });

    const result = await startCamera(
      {
        videoElement: createMockVideoElement(),
        captureCanvas: document.createElement("canvas"),
      },
      DEFAULT_START_CAMERA_OPTIONS,
    );

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.reason).toBe("permissionDenied");
  });

  it("returns cameraReady when stream metadata and first frame succeed", async () => {
    vi.stubGlobal("isSecureContext", true);
    const mediaStream = new MediaStream();
    vi.stubGlobal("navigator", {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([{ kind: "videoinput", label: "Mock Camera" }]),
        getUserMedia: vi.fn().mockResolvedValue(mediaStream),
      },
    });

    Object.defineProperty(mediaStream, "getVideoTracks", {
      value: () => [
        {
          label: "Mock Camera",
          getSettings: () => ({}),
        },
      ],
    });
    Object.defineProperty(mediaStream, "getTracks", {
      value: () => [],
    });

    const result = await startCamera(
      {
        videoElement: createMockVideoElement(),
        captureCanvas: createCaptureCanvasWithVisiblePixels(),
      },
      DEFAULT_START_CAMERA_OPTIONS,
    );

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.videoWidth).toBe(640);
    expect(result.videoHeight).toBe(480);
    expect(result.cameraLabel).toBe("Mock Camera");
    expect(result.requestedFrameRateSelection).toBe("deviceDefault");
    expect(result.actualFrameRate).toBeNull();
  });

  it("requests a capped 30 fps constraint when selected", async () => {
    vi.stubGlobal("isSecureContext", true);
    const mediaStream = new MediaStream();
    const getUserMedia = vi.fn().mockResolvedValue(mediaStream);

    vi.stubGlobal("navigator", {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([{ kind: "videoinput", label: "Mock Camera" }]),
        getUserMedia,
      },
    });

    Object.defineProperty(mediaStream, "getVideoTracks", {
      value: () => [
        {
          label: "Mock Camera",
          getSettings: () => ({ frameRate: CAMERA_FRAME_RATE_30_FPS }),
          getCapabilities: () => ({ frameRate: { min: 1, max: CAMERA_FRAME_RATE_30_FPS } }),
          applyConstraints: vi.fn().mockResolvedValue(undefined),
        },
      ],
    });
    Object.defineProperty(mediaStream, "getTracks", {
      value: () => [],
    });

    const result = await startCamera(
      {
        videoElement: createMockVideoElement(),
        captureCanvas: createCaptureCanvasWithVisiblePixels(),
      },
      { frameRateSelection: "30", resolution: { widthPixels: 1280, heightPixels: 720 } },
    );

    expect(getUserMedia).toHaveBeenCalledWith({
      video: expect.objectContaining({
        frameRate: {
          min: CAMERA_FRAME_RATE_30_FPS,
          ideal: CAMERA_FRAME_RATE_30_FPS,
          max: CAMERA_FRAME_RATE_30_FPS,
        },
      }),
      audio: false,
    });
    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.requestedFrameRateSelection).toBe("30");
    expect(result.actualFrameRate).toBe(CAMERA_FRAME_RATE_30_FPS);
    expect(result.frameRateMismatch).toBe(false);
  });
});
