/**
 * Application entrypoint: camera gates, kibo-tag detection, and AprilCube pose overlay.
 */
import {
  estimateAprilCubePose,
  type CameraIntrinsics,
  type DetectedMarkerCorners,
  type EstimateAprilCubePoseResult,
} from "kibo-track";
import {
  buildAprilCubeConfigFromLayoutJson,
  EXAMPLE_APRILCUBE_LAYOUT_JSON,
} from "./aprilcube-config.js";
import { captureVideoFrameToGrayscale } from "./camera.js";
import { startCamera, stopCameraStream } from "./camera-startup.js";
import {
  detectAprilCubeMarkers,
  initializeKiboTagDetector,
  type KiboTagApriltagInstance,
} from "./kibo-tag-detector.js";
import { drawOverlay } from "./overlay.js";
import { createPlaceholderReferenceCameraIntrinsics } from "./reference-intrinsics.js";
import {
  synchronizeOverlayCanvasSize,
  validateResolutionConsistency,
} from "./resolution-gate.js";
import type { AppLifecycleState, CornerOrderSelection, ResolutionSnapshot } from "./types.js";

interface AppDomElements {
  readonly startCameraButton: HTMLButtonElement;
  readonly startDetectorButton: HTMLButtonElement;
  readonly cornerOrderSelect: HTMLSelectElement;
  readonly appStatusElement: HTMLElement;
  readonly cameraStatusElement: HTMLElement;
  readonly resolutionStatusElement: HTMLElement;
  readonly detectorStatusElement: HTMLElement;
  readonly poseStatusElement: HTMLElement;
  readonly diagnosticsTextElement: HTMLElement;
  readonly videoElement: HTMLVideoElement;
  readonly captureCanvas: HTMLCanvasElement;
  readonly overlayCanvas: HTMLCanvasElement;
}

interface AppRuntimeState {
  lifecycleState: AppLifecycleState;
  mediaStream: MediaStream | null;
  detector: KiboTagApriltagInstance | null;
  scaledCameraIntrinsics: CameraIntrinsics | null;
  resolutionSnapshot: ResolutionSnapshot | null;
  intrinsicsArePlaceholder: boolean;
  detectedMarkers: DetectedMarkerCorners[];
  latestPoseResult: EstimateAprilCubePoseResult | null;
  animationFrameIdentifier: number | null;
  isProcessingTrackingFrame: boolean;
}

function readDomElements(): AppDomElements {
  const startCameraButton = document.querySelector<HTMLButtonElement>("#start-camera-button");
  const startDetectorButton = document.querySelector<HTMLButtonElement>("#start-detector-button");
  const cornerOrderSelect = document.querySelector<HTMLSelectElement>("#corner-order-select");
  const appStatusElement = document.querySelector<HTMLElement>("#app-status");
  const cameraStatusElement = document.querySelector<HTMLElement>("#camera-status");
  const resolutionStatusElement = document.querySelector<HTMLElement>("#resolution-status");
  const detectorStatusElement = document.querySelector<HTMLElement>("#detector-status");
  const poseStatusElement = document.querySelector<HTMLElement>("#pose-status");
  const diagnosticsTextElement = document.querySelector<HTMLElement>("#diagnostics-text");
  const videoElement = document.querySelector<HTMLVideoElement>("#camera-video");
  const captureCanvas = document.querySelector<HTMLCanvasElement>("#capture-canvas");
  const overlayCanvas = document.querySelector<HTMLCanvasElement>("#overlay-canvas");

  if (
    startCameraButton === null ||
    startDetectorButton === null ||
    cornerOrderSelect === null ||
    appStatusElement === null ||
    cameraStatusElement === null ||
    resolutionStatusElement === null ||
    detectorStatusElement === null ||
    poseStatusElement === null ||
    diagnosticsTextElement === null ||
    videoElement === null ||
    captureCanvas === null ||
    overlayCanvas === null
  ) {
    throw new Error("Required DOM elements are missing.");
  }

  return {
    startCameraButton,
    startDetectorButton,
    cornerOrderSelect,
    appStatusElement,
    cameraStatusElement,
    resolutionStatusElement,
    detectorStatusElement,
    poseStatusElement,
    diagnosticsTextElement,
    videoElement,
    captureCanvas,
    overlayCanvas,
  };
}

function createInitialRuntimeState(): AppRuntimeState {
  return {
    lifecycleState: "idle",
    mediaStream: null,
    detector: null,
    scaledCameraIntrinsics: null,
    resolutionSnapshot: null,
    intrinsicsArePlaceholder: true,
    detectedMarkers: [],
    latestPoseResult: null,
    animationFrameIdentifier: null,
    isProcessingTrackingFrame: false,
  };
}

function readSelectedCornerOrder(cornerOrderSelect: HTMLSelectElement): CornerOrderSelection {
  const selectedValue = cornerOrderSelect.value;

  if (
    selectedValue === "canonical" ||
    selectedValue === "clockwiseRotate90" ||
    selectedValue === "clockwiseRotate180" ||
    selectedValue === "clockwiseRotate270" ||
    selectedValue === "reverse"
  ) {
    return selectedValue;
  }

  return "canonical";
}

function formatDiagnostics(state: AppRuntimeState): string {
  const lines = [
    `lifecycle: ${state.lifecycleState}`,
    `cameraLabel: ${state.mediaStream?.getVideoTracks()[0]?.label ?? "none"}`,
    `intrinsicsArePlaceholder: ${state.intrinsicsArePlaceholder}`,
    `detectedMarkerCount: ${state.detectedMarkers.length}`,
  ];

  if (state.resolutionSnapshot !== null) {
    lines.push(
      `video: ${state.resolutionSnapshot.videoWidth}x${state.resolutionSnapshot.videoHeight}`,
      `captureCanvas: ${state.resolutionSnapshot.captureCanvasWidth}x${state.resolutionSnapshot.captureCanvasHeight}`,
      `overlayCanvas: ${state.resolutionSnapshot.overlayCanvasWidth}x${state.resolutionSnapshot.overlayCanvasHeight}`,
      `overlayCss: ${state.resolutionSnapshot.overlayCssWidth.toFixed(1)}x${state.resolutionSnapshot.overlayCssHeight.toFixed(1)}`,
      `devicePixelRatio: ${state.resolutionSnapshot.devicePixelRatio}`,
      `grayscaleLength: ${state.resolutionSnapshot.grayscaleBufferLength}`,
      `intrinsicsReference: ${state.resolutionSnapshot.intrinsicsReferenceWidth}x${state.resolutionSnapshot.intrinsicsReferenceHeight}`,
    );
  }

  if (state.scaledCameraIntrinsics !== null) {
    lines.push(
      `scaledFx: ${state.scaledCameraIntrinsics.focalLengthX.toFixed(2)}`,
      `scaledFy: ${state.scaledCameraIntrinsics.focalLengthY.toFixed(2)}`,
      `scaledCx: ${state.scaledCameraIntrinsics.principalPointX.toFixed(2)}`,
      `scaledCy: ${state.scaledCameraIntrinsics.principalPointY.toFixed(2)}`,
    );
  }

  if (state.latestPoseResult !== null) {
    if (state.latestPoseResult.success) {
      lines.push(
        `poseSuccess: true`,
        `correspondenceCount: ${state.latestPoseResult.correspondenceCount}`,
        `finalReprojectionPx: ${state.latestPoseResult.finalMeanReprojectionErrorPx.toExponential(3)}`,
        `confidence: ${state.latestPoseResult.confidence.toFixed(4)}`,
        `numInliers: ${state.latestPoseResult.numInliers}`,
      );
    } else {
      lines.push(
        `poseSuccess: false`,
        `poseStage: ${state.latestPoseResult.stage}`,
        `poseReason: ${state.latestPoseResult.reason}`,
      );
    }
  }

  return lines.join("\n");
}

function updateUi(
  domElements: AppDomElements,
  state: AppRuntimeState,
  cameraMessage: string,
  resolutionMessage: string,
  detectorMessage: string,
  poseMessage: string,
): void {
  domElements.appStatusElement.textContent = state.lifecycleState;
  domElements.cameraStatusElement.textContent = cameraMessage;
  domElements.resolutionStatusElement.textContent = resolutionMessage;
  domElements.detectorStatusElement.textContent = detectorMessage;
  domElements.poseStatusElement.textContent = poseMessage;
  domElements.diagnosticsTextElement.textContent = formatDiagnostics(state);
  domElements.startDetectorButton.disabled = state.lifecycleState !== "resolutionReady";
}

async function handleStartCamera(
  domElements: AppDomElements,
  state: AppRuntimeState,
): Promise<void> {
  state.lifecycleState = "startingCamera";
  updateUi(domElements, state, "starting", "pending", "not started", "not estimated");

  const startupResult = await startCamera({
    videoElement: domElements.videoElement,
    captureCanvas: domElements.captureCanvas,
  });

  if (!startupResult.success) {
    state.lifecycleState = "failed";
    updateUi(
      domElements,
      state,
      `${startupResult.reason}: ${startupResult.detail}`,
      "blocked",
      "blocked",
      "blocked",
    );
    return;
  }

  state.mediaStream = startupResult.mediaStream;
  state.lifecycleState = "cameraReady";
  domElements.videoElement.hidden = false;
  synchronizeOverlayCanvasSize(domElements.captureCanvas, domElements.overlayCanvas);

  const frameCapture = captureVideoFrameToGrayscale(
    domElements.videoElement,
    domElements.captureCanvas,
  );

  if (frameCapture === null) {
    state.lifecycleState = "failed";
    updateUi(domElements, state, "cameraReady", "emptyFrame", "blocked", "blocked");
    return;
  }

  const resolutionResult = validateResolutionConsistency({
    videoWidth: startupResult.videoWidth,
    videoHeight: startupResult.videoHeight,
    captureCanvas: domElements.captureCanvas,
    overlayCanvas: domElements.overlayCanvas,
    grayscaleBufferLength: frameCapture.grayscaleBuffer.length,
    referenceCameraIntrinsics: createPlaceholderReferenceCameraIntrinsics(),
  });

  if (!resolutionResult.success) {
    state.lifecycleState = "failed";
    updateUi(
      domElements,
      state,
      "cameraReady",
      `${resolutionResult.reason}: ${resolutionResult.detail}`,
      "blocked",
      "blocked",
    );
    return;
  }

  state.lifecycleState = "resolutionReady";
  state.scaledCameraIntrinsics = resolutionResult.scaledCameraIntrinsics;
  state.resolutionSnapshot = resolutionResult.snapshot;
  state.intrinsicsArePlaceholder = resolutionResult.intrinsicsArePlaceholder;

  const aprilCubeConfig = buildAprilCubeConfigFromLayoutJson(EXAMPLE_APRILCUBE_LAYOUT_JSON);

  drawOverlay({
    overlayCanvas: domElements.overlayCanvas,
    captureCanvas: domElements.captureCanvas,
    detectedMarkers: [],
    pose: null,
    cubeSizeMeters: aprilCubeConfig.cubeSize,
    cameraIntrinsics: resolutionResult.scaledCameraIntrinsics,
  });

  updateUi(
    domElements,
    state,
    `cameraReady ${startupResult.videoWidth}x${startupResult.videoHeight}`,
    "resolutionReady",
    "not started",
    state.intrinsicsArePlaceholder ? "approximate intrinsics" : "ready",
  );
}

function stopTrackingLoop(state: AppRuntimeState): void {
  if (state.animationFrameIdentifier !== null) {
    cancelAnimationFrame(state.animationFrameIdentifier);
    state.animationFrameIdentifier = null;
  }
}

async function runTrackingFrame(
  domElements: AppDomElements,
  state: AppRuntimeState,
): Promise<void> {
  if (state.detector === null || state.scaledCameraIntrinsics === null) {
    return;
  }

  const frameCapture = captureVideoFrameToGrayscale(
    domElements.videoElement,
    domElements.captureCanvas,
  );

  if (frameCapture === null) {
    return;
  }

  try {
    state.detectedMarkers = await detectAprilCubeMarkers(
      state.detector,
      frameCapture.grayscaleBuffer,
      frameCapture.captureWidth,
      frameCapture.captureHeight,
    );
  } catch (error) {
    state.lifecycleState = "failed";
    updateUi(
      domElements,
      state,
      "cameraReady",
      "resolutionReady",
      error instanceof Error ? error.message : "detect failed",
      "blocked",
    );
    stopTrackingLoop(state);
    return;
  }

  const aprilCubeConfig = buildAprilCubeConfigFromLayoutJson(
    EXAMPLE_APRILCUBE_LAYOUT_JSON,
    readSelectedCornerOrder(domElements.cornerOrderSelect),
  );

  state.latestPoseResult = estimateAprilCubePose(
    {
      markers: state.detectedMarkers,
      config: aprilCubeConfig,
      cameraIntrinsics: state.scaledCameraIntrinsics,
    },
    { enableRansac: true },
  );

  const pose =
    state.latestPoseResult.success === true ? state.latestPoseResult.pose : null;

  drawOverlay({
    overlayCanvas: domElements.overlayCanvas,
    captureCanvas: domElements.captureCanvas,
    detectedMarkers: state.detectedMarkers,
    pose,
    cubeSizeMeters: aprilCubeConfig.cubeSize,
    cameraIntrinsics: state.scaledCameraIntrinsics,
  });

  const poseMessage =
    state.latestPoseResult.success === true
      ? `success reproj=${state.latestPoseResult.finalMeanReprojectionErrorPx.toExponential(3)}`
      : `${state.latestPoseResult.stage}:${state.latestPoseResult.reason}`;

  updateUi(
    domElements,
    state,
    domElements.cameraStatusElement.textContent ?? "cameraReady",
    "resolutionReady",
    "detectorReady",
    poseMessage,
  );
}

function startTrackingLoop(domElements: AppDomElements, state: AppRuntimeState): void {
  stopTrackingLoop(state);

  const tick = (): void => {
    if (state.isProcessingTrackingFrame) {
      state.animationFrameIdentifier = requestAnimationFrame(tick);
      return;
    }

    state.isProcessingTrackingFrame = true;

    void runTrackingFrame(domElements, state).finally(() => {
      state.isProcessingTrackingFrame = false;
      state.animationFrameIdentifier = requestAnimationFrame(tick);
    });
  };

  state.animationFrameIdentifier = requestAnimationFrame(tick);
}

async function handleStartDetector(
  domElements: AppDomElements,
  state: AppRuntimeState,
): Promise<void> {
  if (state.lifecycleState !== "resolutionReady") {
    return;
  }

  state.lifecycleState = "loadingDetector";
  updateUi(
    domElements,
    state,
    domElements.cameraStatusElement.textContent ?? "cameraReady",
    "resolutionReady",
    "loading",
    "waiting",
  );

  const detectorLoadResult = await initializeKiboTagDetector();

  if (!detectorLoadResult.success) {
    state.lifecycleState = "failed";
    updateUi(
      domElements,
      state,
      domElements.cameraStatusElement.textContent ?? "cameraReady",
      "resolutionReady",
      `${detectorLoadResult.reason}: ${detectorLoadResult.detail}`,
      "blocked",
    );
    return;
  }

  state.detector = detectorLoadResult.detector;
  state.lifecycleState = "tracking";
  updateUi(
    domElements,
    state,
    domElements.cameraStatusElement.textContent ?? "cameraReady",
    "resolutionReady",
    "detectorReady",
    "starting",
  );
  startTrackingLoop(domElements, state);
}

function bindApplication(): void {
  const domElements = readDomElements();
  const state = createInitialRuntimeState();

  domElements.startCameraButton.addEventListener("click", () => {
    if (state.lifecycleState === "startingCamera" || state.lifecycleState === "tracking") {
      return;
    }

    void handleStartCamera(domElements, state);
  });

  domElements.startDetectorButton.addEventListener("click", () => {
    if (state.lifecycleState === "loadingDetector" || state.lifecycleState === "tracking") {
      return;
    }

    void handleStartDetector(domElements, state);
  });

  window.addEventListener("pagehide", () => {
    stopTrackingLoop(state);
    stopCameraStream(state.mediaStream);
  });

  updateUi(domElements, state, "not started", "not checked", "not started", "not estimated");
}

bindApplication();
