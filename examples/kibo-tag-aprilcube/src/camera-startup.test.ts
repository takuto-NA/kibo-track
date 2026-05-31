/**
 * Unit tests for camera startup gate behavior.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { startCamera } from "./camera-startup.js";

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

    const result = await startCamera({
      videoElement: createMockVideoElement(),
      captureCanvas: document.createElement("canvas"),
    });

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

    const result = await startCamera({
      videoElement: createMockVideoElement(),
      captureCanvas: document.createElement("canvas"),
    });

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

    const result = await startCamera({
      videoElement: createMockVideoElement(),
      captureCanvas: document.createElement("canvas"),
    });

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

    const result = await startCamera({
      videoElement: createMockVideoElement(),
      captureCanvas: document.createElement("canvas"),
    });

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
      value: () => [{ label: "Mock Camera" }],
    });
    Object.defineProperty(mediaStream, "getTracks", {
      value: () => [],
    });

    const result = await startCamera({
      videoElement: createMockVideoElement(),
      captureCanvas: createCaptureCanvasWithVisiblePixels(),
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.videoWidth).toBe(640);
    expect(result.videoHeight).toBe(480);
    expect(result.cameraLabel).toBe("Mock Camera");
  });
});
