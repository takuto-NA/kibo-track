/**
 * Application entrypoint: camera gates, kibo-tag detection, and AprilCube pose overlay.
 */
import {
  estimateAprilCubePose,
  type CameraIntrinsics,
  type DetectedMarkerCorners,
  type EstimateAprilCubePoseResult,
  type Pose,
} from "kibo-track";
import {
  buildAprilCubeConfigFromLayoutJson,
  EXAMPLE_APRILCUBE_LAYOUT_JSON,
} from "./aprilcube-config.js";
import { captureVideoFrameToGrayscale } from "./camera.js";
import {
  formatCameraFrameRateProbeMessage,
  probeCameraFrameRateOptions,
  readSelectedCameraFrameRateSelection,
  readVideoTrackFrameRate,
  renderCameraFrameRateSelectOptions,
} from "./camera-frame-rate.js";
import {
  cameraResolutionMatchesRequest,
  formatCameraResolutionLabel,
  readSelectedCameraResolution,
  renderCameraResolutionSelectOptions,
  type CameraResolutionPixels,
} from "./camera-resolution.js";
import { startCamera, stopCameraStream } from "./camera-startup.js";
import {
  detectAprilCubeMarkers,
  initializeKiboTagDetector,
  type KiboTagApriltagInstance,
} from "./kibo-tag-detector.js";
import { drawOverlay, type OverlayDrawInput } from "./overlay.js";
import { formatPoseDisplayLines } from "./format-pose-display.js";
import { undistortDetectedMarkers } from "./camera-distortion.js";
import { parseCalibrationJson } from "./parse-calibration-json.js";
import { PoseTracker } from "./pose-tracker.js";
import {
  clearPersistedCalibration,
  persistCalibrationJson,
  resolveReferenceCameraIntrinsics,
  type IntrinsicsSourceLabel,
} from "./resolve-reference-intrinsics.js";
import {
  synchronizeOverlayCanvasSize,
  validateResolutionConsistency,
} from "./resolution-gate.js";
import {
  INTRINSICS_REFERENCE_HEIGHT_PIXELS,
  INTRINSICS_REFERENCE_WIDTH_PIXELS,
} from "./constants.js";
import type {
  AppLifecycleState,
  CameraFrameRateSelection,
  CornerOrderSelection,
  OverlayDisplayMode,
  ResolutionSnapshot,
} from "./types.js";

interface AppDomElements {
  readonly startCameraButton: HTMLButtonElement;
  readonly startDetectorButton: HTMLButtonElement;
  readonly cameraResolutionSelect: HTMLSelectElement;
  readonly cameraFrameRateSelect: HTMLSelectElement;
  readonly cameraFrameRateHintElement: HTMLElement;
  readonly cornerOrderSelect: HTMLSelectElement;
  readonly calibrationJsonInput: HTMLTextAreaElement;
  readonly applyCalibrationButton: HTMLButtonElement;
  readonly clearCalibrationButton: HTMLButtonElement;
  readonly calibrationStatusElement: HTMLElement;
  readonly appStatusElement: HTMLElement;
  readonly cameraStatusElement: HTMLElement;
  readonly resolutionStatusElement: HTMLElement;
  readonly detectorStatusElement: HTMLElement;
  readonly poseStatusElement: HTMLElement;
  readonly diagnosticsTextElement: HTMLElement;
  readonly detectionResultsTextElement: HTMLElement;
  readonly wireframeOnlyCheckbox: HTMLInputElement;
  readonly viewportElement: HTMLElement;
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
  intrinsicsSource: IntrinsicsSourceLabel;
  distortionCoefficients: readonly number[];
  detectedMarkers: DetectedMarkerCorners[];
  latestPoseResult: EstimateAprilCubePoseResult | null;
  trackedPose: Pose | null;
  animationFrameIdentifier: number | null;
  isProcessingTrackingFrame: boolean;
  poseTracker: PoseTracker;
  overlayDisplayMode: OverlayDisplayMode;
  requestedCameraResolution: CameraResolutionPixels;
  requestedCameraFrameRateSelection: CameraFrameRateSelection;
  actualCameraFrameRate: number | null;
  cameraFrameRateCapabilityMin: number | null;
  cameraFrameRateCapabilityMax: number | null;
  cameraFrameRateMismatch: boolean;
}

function readDomElements(): AppDomElements {
  const startCameraButton = document.querySelector<HTMLButtonElement>("#start-camera-button");
  const startDetectorButton = document.querySelector<HTMLButtonElement>("#start-detector-button");
  const cameraResolutionSelect = document.querySelector<HTMLSelectElement>("#camera-resolution-select");
  const cameraFrameRateSelect = document.querySelector<HTMLSelectElement>("#camera-frame-rate-select");
  const cameraFrameRateHintElement = document.querySelector<HTMLElement>("#camera-frame-rate-hint");
  const cornerOrderSelect = document.querySelector<HTMLSelectElement>("#corner-order-select");
  const calibrationJsonInput = document.querySelector<HTMLTextAreaElement>("#calibration-json-input");
  const applyCalibrationButton = document.querySelector<HTMLButtonElement>("#apply-calibration-button");
  const clearCalibrationButton = document.querySelector<HTMLButtonElement>("#clear-calibration-button");
  const calibrationStatusElement = document.querySelector<HTMLElement>("#calibration-status");
  const appStatusElement = document.querySelector<HTMLElement>("#app-status");
  const cameraStatusElement = document.querySelector<HTMLElement>("#camera-status");
  const resolutionStatusElement = document.querySelector<HTMLElement>("#resolution-status");
  const detectorStatusElement = document.querySelector<HTMLElement>("#detector-status");
  const poseStatusElement = document.querySelector<HTMLElement>("#pose-status");
  const diagnosticsTextElement = document.querySelector<HTMLElement>("#diagnostics-text");
  const detectionResultsTextElement = document.querySelector<HTMLElement>("#detection-results-text");
  const wireframeOnlyCheckbox = document.querySelector<HTMLInputElement>("#wireframe-only-checkbox");
  const viewportElement = document.querySelector<HTMLElement>("#viewport");
  const videoElement = document.querySelector<HTMLVideoElement>("#camera-video");
  const captureCanvas = document.querySelector<HTMLCanvasElement>("#capture-canvas");
  const overlayCanvas = document.querySelector<HTMLCanvasElement>("#overlay-canvas");

  if (
    startCameraButton === null ||
    startDetectorButton === null ||
    cameraResolutionSelect === null ||
    cameraFrameRateSelect === null ||
    cameraFrameRateHintElement === null ||
    cornerOrderSelect === null ||
    calibrationJsonInput === null ||
    applyCalibrationButton === null ||
    clearCalibrationButton === null ||
    calibrationStatusElement === null ||
    appStatusElement === null ||
    cameraStatusElement === null ||
    resolutionStatusElement === null ||
    detectorStatusElement === null ||
    poseStatusElement === null ||
    diagnosticsTextElement === null ||
    detectionResultsTextElement === null ||
    wireframeOnlyCheckbox === null ||
    viewportElement === null ||
    videoElement === null ||
    captureCanvas === null ||
    overlayCanvas === null
  ) {
    throw new Error("Required DOM elements are missing.");
  }

  return {
    startCameraButton,
    startDetectorButton,
    cameraResolutionSelect,
    cameraFrameRateSelect,
    cameraFrameRateHintElement,
    cornerOrderSelect,
    calibrationJsonInput,
    applyCalibrationButton,
    clearCalibrationButton,
    calibrationStatusElement,
    appStatusElement,
    cameraStatusElement,
    resolutionStatusElement,
    detectorStatusElement,
    poseStatusElement,
    diagnosticsTextElement,
    detectionResultsTextElement,
    wireframeOnlyCheckbox,
    viewportElement,
    videoElement,
    captureCanvas,
    overlayCanvas,
  };
}

function createInitialRuntimeState(): AppRuntimeState {
  const resolvedIntrinsics = resolveReferenceCameraIntrinsics();

  return {
    lifecycleState: "idle",
    mediaStream: null,
    detector: null,
    scaledCameraIntrinsics: null,
    resolutionSnapshot: null,
    intrinsicsSource: resolvedIntrinsics.intrinsicsSource,
    distortionCoefficients: resolvedIntrinsics.distortionCoefficients,
    detectedMarkers: [],
    latestPoseResult: null,
    trackedPose: null,
    animationFrameIdentifier: null,
    isProcessingTrackingFrame: false,
    poseTracker: new PoseTracker(),
    overlayDisplayMode: "cameraWithOverlay",
    requestedCameraResolution: {
      widthPixels: INTRINSICS_REFERENCE_WIDTH_PIXELS,
      heightPixels: INTRINSICS_REFERENCE_HEIGHT_PIXELS,
    },
    requestedCameraFrameRateSelection: "deviceDefault",
    actualCameraFrameRate: null,
    cameraFrameRateCapabilityMin: null,
    cameraFrameRateCapabilityMax: null,
    cameraFrameRateMismatch: false,
  };
}

function readSelectedCornerOrder(cornerOrderSelect: HTMLSelectElement): CornerOrderSelection {
  const selectedValue = cornerOrderSelect.value;

  if (
    selectedValue === "canonical" ||
    selectedValue === "clockwiseRotate90" ||
    selectedValue === "clockwiseRotate180" ||
    selectedValue === "clockwiseRotate270" ||
    selectedValue === "reverse" ||
    selectedValue === "reversedCanonical"
  ) {
    return selectedValue;
  }

  return "reversedCanonical";
}

function readOverlayDisplayMode(wireframeOnlyCheckbox: HTMLInputElement): OverlayDisplayMode {
  if (wireframeOnlyCheckbox.checked) {
    return "wireframeOnly";
  }

  return "cameraWithOverlay";
}

function syncViewportOverlayDisplayMode(
  viewportElement: HTMLElement,
  overlayDisplayMode: OverlayDisplayMode,
): void {
  viewportElement.classList.toggle(
    "viewport-wireframe-only",
    overlayDisplayMode === "wireframeOnly",
  );
}

function buildOverlayDrawInput(
  domElements: AppDomElements,
  state: AppRuntimeState,
  detectedMarkers: ReadonlyArray<DetectedMarkerCorners>,
  pose: Pose | null,
  cubeSizeMeters: number,
): OverlayDrawInput {
  state.overlayDisplayMode = readOverlayDisplayMode(domElements.wireframeOnlyCheckbox);
  syncViewportOverlayDisplayMode(domElements.viewportElement, state.overlayDisplayMode);

  return {
    overlayCanvas: domElements.overlayCanvas,
    captureCanvas: domElements.captureCanvas,
    detectedMarkers,
    pose,
    cubeSizeMeters,
    cameraIntrinsics: state.scaledCameraIntrinsics!,
    distortionCoefficients: state.distortionCoefficients,
    overlayDisplayMode: state.overlayDisplayMode,
  };
}

function redrawCurrentOverlayFrame(domElements: AppDomElements, state: AppRuntimeState): void {
  if (state.scaledCameraIntrinsics === null) {
    return;
  }

  const aprilCubeConfig = buildAprilCubeConfigFromLayoutJson(
    EXAMPLE_APRILCUBE_LAYOUT_JSON,
    readSelectedCornerOrder(domElements.cornerOrderSelect),
  );

  drawOverlay(
    buildOverlayDrawInput(
      domElements,
      state,
      state.detectedMarkers,
      state.trackedPose,
      aprilCubeConfig.cubeSize,
    ),
  );
}

function formatDiagnostics(state: AppRuntimeState): string {
  const trackerSnapshot = state.poseTracker.getSnapshot();
  const lines = [
    `lifecycle: ${state.lifecycleState}`,
    `cameraLabel: ${state.mediaStream?.getVideoTracks()[0]?.label ?? "none"}`,
    `intrinsicsSource: ${state.intrinsicsSource}`,
    `distortionCoeffCount: ${state.distortionCoefficients.length}`,
    `trackerState: ${trackerSnapshot.trackerState}`,
    `coastFrameCount: ${trackerSnapshot.coastFrameCount}`,
    `detectedMarkerCount: ${state.detectedMarkers.length}`,
    `overlayDisplayMode: ${state.overlayDisplayMode}`,
    `requestedCameraResolution: ${formatCameraResolutionLabel(state.requestedCameraResolution)}`,
    `requestedCameraFrameRate: ${state.requestedCameraFrameRateSelection}`,
    `actualCameraFrameRate: ${state.actualCameraFrameRate ?? "unknown"}`,
    `cameraFrameRateCapability: ${formatFrameRateCapabilityRange(
      state.cameraFrameRateCapabilityMin,
      state.cameraFrameRateCapabilityMax,
    )}`,
    `cameraFrameRateMismatch: ${state.cameraFrameRateMismatch}`,
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
        `poseMode: ${state.latestPoseResult.poseMode}`,
        `visibleFaceCount: ${state.latestPoseResult.visibleFaceCount}`,
        `detectedMarkerIds: ${state.latestPoseResult.detectedMarkerIds.join(",")}`,
        `correspondenceCount: ${state.latestPoseResult.correspondenceCount}`,
        `finalReprojectionPx: ${state.latestPoseResult.finalMeanReprojectionErrorPx.toExponential(3)}`,
        `confidence: ${state.latestPoseResult.confidence.toFixed(4)}`,
        `numInliers: ${state.latestPoseResult.numInliers}`,
      );

      if (state.latestPoseResult.planarCandidateCount !== undefined) {
        lines.push(`planarCandidateCount: ${state.latestPoseResult.planarCandidateCount}`);
      }

      if (state.latestPoseResult.planarAmbiguityScore !== undefined) {
        lines.push(
          `planarAmbiguityScore: ${state.latestPoseResult.planarAmbiguityScore.toExponential(3)}`,
        );
      }

      if (state.latestPoseResult.rejectedMarkerIds.length > 0) {
        lines.push(`rejectedMarkerIds: ${state.latestPoseResult.rejectedMarkerIds.join(",")}`);
      }
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

function formatDetectionResults(state: AppRuntimeState): string {
  if (state.detectedMarkers.length === 0) {
    return "Detected markers: none";
  }

  const detectedMarkerIds = state.detectedMarkers.map((marker) => marker.id).join(", ");
  const lines = [`Detected markers: ${detectedMarkerIds}`];

  if (state.latestPoseResult === null) {
    return lines.join("\n");
  }

  if (state.latestPoseResult.success) {
    lines.push(
      `Measured: ${state.latestPoseResult.poseMode} · ${state.latestPoseResult.finalMeanReprojectionErrorPx.toFixed(2)} px`,
    );

    const displayPose = state.trackedPose ?? state.latestPoseResult.pose;
    lines.push(...formatPoseDisplayLines(displayPose));

    if (state.latestPoseResult.rejectedMarkerIds.length > 0) {
      lines.push(`Rejected markers: ${state.latestPoseResult.rejectedMarkerIds.join(", ")}`);
    }

    return lines.join("\n");
  }

  lines.push(`Pose: failed (${state.latestPoseResult.stage}: ${state.latestPoseResult.reason})`);
  return lines.join("\n");
}

function formatFrameRateCapabilityRange(
  capabilityMinFrameRate: number | null,
  capabilityMaxFrameRate: number | null,
): string {
  if (capabilityMinFrameRate === null && capabilityMaxFrameRate === null) {
    return "unknown";
  }

  return `${capabilityMinFrameRate ?? "?"}-${capabilityMaxFrameRate ?? "?"} fps`;
}

function formatCameraStatusMessage(
  videoWidth: number,
  videoHeight: number,
  actualFrameRate: number | null,
  requestedResolution: CameraResolutionPixels,
  requestedFrameRateSelection: CameraFrameRateSelection,
  frameRateMismatch: boolean,
  capabilityMaxFrameRate: number | null,
): string {
  const resolutionMessage = `cameraReady ${videoWidth}x${videoHeight}`;
  const resolutionMismatch = !cameraResolutionMatchesRequest(
    requestedResolution,
    videoWidth,
    videoHeight,
  );
  const resolutionSuffix = resolutionMismatch
    ? ` (requested ${formatCameraResolutionLabel(requestedResolution)})`
    : "";

  if (actualFrameRate === null) {
    return `${resolutionMessage}${resolutionSuffix}`;
  }

  const frameRateMessage = `${resolutionMessage}${resolutionSuffix} @ ${actualFrameRate.toFixed(1)} fps`;

  if (!frameRateMismatch) {
    return frameRateMessage;
  }

  if (requestedFrameRateSelection !== "deviceDefault") {
    const capabilityHint =
      capabilityMaxFrameRate !== null
        ? `, device max ${capabilityMaxFrameRate.toFixed(0)} at this resolution`
        : "";

    return `${frameRateMessage} (requested ${requestedFrameRateSelection} fps${capabilityHint})`;
  }

  return frameRateMessage;
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
  domElements.detectionResultsTextElement.textContent = formatDetectionResults(state);
  domElements.startDetectorButton.disabled = state.lifecycleState !== "resolutionReady";
  const cameraControlsLocked =
    state.lifecycleState !== "idle" && state.lifecycleState !== "failed";
  const cameraProbeInProgress = domElements.cameraFrameRateSelect.dataset.probeComplete !== "true";
  domElements.cameraResolutionSelect.disabled = cameraControlsLocked || cameraProbeInProgress;
  domElements.cameraFrameRateSelect.disabled = cameraControlsLocked || cameraProbeInProgress;
  domElements.calibrationStatusElement.textContent = `calibration: ${state.intrinsicsSource}`;
}

async function handleStartCamera(
  domElements: AppDomElements,
  state: AppRuntimeState,
): Promise<void> {
  state.lifecycleState = "startingCamera";
  state.poseTracker.reset();
  state.requestedCameraResolution = readSelectedCameraResolution(domElements.cameraResolutionSelect);
  state.requestedCameraFrameRateSelection = readSelectedCameraFrameRateSelection(
    domElements.cameraFrameRateSelect,
  );
  updateUi(domElements, state, "starting", "pending", "not started", "not estimated");

  const startupResult = await startCamera(
    {
      videoElement: domElements.videoElement,
      captureCanvas: domElements.captureCanvas,
    },
    {
      frameRateSelection: state.requestedCameraFrameRateSelection,
      resolution: state.requestedCameraResolution,
    },
  );

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
  state.actualCameraFrameRate = startupResult.actualFrameRate;
  state.cameraFrameRateCapabilityMin = startupResult.capabilityMinFrameRate;
  state.cameraFrameRateCapabilityMax = startupResult.capabilityMaxFrameRate;
  state.cameraFrameRateMismatch = startupResult.frameRateMismatch;
  state.lifecycleState = "cameraReady";
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
    referenceCameraIntrinsics: resolveReferenceCameraIntrinsics().referenceCameraIntrinsics,
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
  state.intrinsicsSource = resolutionResult.intrinsicsArePlaceholder
    ? "placeholder"
    : "calibrated";

  const aprilCubeConfig = buildAprilCubeConfigFromLayoutJson(
    EXAMPLE_APRILCUBE_LAYOUT_JSON,
    "reversedCanonical",
  );

  drawOverlay(
    buildOverlayDrawInput(
      domElements,
      state,
      [],
      null,
      aprilCubeConfig.cubeSize,
    ),
  );

  updateUi(
    domElements,
    state,
    formatCameraStatusMessage(
      startupResult.videoWidth,
      startupResult.videoHeight,
      startupResult.actualFrameRate,
      state.requestedCameraResolution,
      startupResult.requestedFrameRateSelection,
      startupResult.frameRateMismatch,
      startupResult.capabilityMaxFrameRate,
    ),
    "resolutionReady",
    "not started",
    state.intrinsicsSource === "placeholder" ? "approximate intrinsics" : "calibrated intrinsics",
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

  if (state.detectedMarkers.length === 0) {
    const missedFrameUpdate = state.poseTracker.updateFromMissedFrame();
    state.trackedPose = missedFrameUpdate.trackedPose;
    state.latestPoseResult = null;

    drawOverlay(
      buildOverlayDrawInput(
        domElements,
        state,
        [],
        missedFrameUpdate.trackedPose,
        aprilCubeConfig.cubeSize,
      ),
    );

    updateUi(
      domElements,
      state,
      domElements.cameraStatusElement.textContent ?? "cameraReady",
      "resolutionReady",
      "detectorReady",
      missedFrameUpdate.trackerState,
    );
    return;
  }

  const poseEstimationMarkers = undistortDetectedMarkers(
    state.detectedMarkers,
    state.scaledCameraIntrinsics,
    state.distortionCoefficients,
  );

  state.latestPoseResult = estimateAprilCubePose(
    {
      markers: poseEstimationMarkers,
      config: aprilCubeConfig,
      cameraIntrinsics: state.scaledCameraIntrinsics,
    },
    {
      enableRansac: true,
      previousPose: state.trackedPose ?? undefined,
    },
  );

  let overlayPose: Pose | null = null;
  let poseMessage = "failed";

  if (state.latestPoseResult.success) {
    const trackerUpdate = state.poseTracker.updateFromMeasurement({
      pose: state.latestPoseResult.pose,
      finalMeanReprojectionErrorPx: state.latestPoseResult.finalMeanReprojectionErrorPx,
      detectedMarkerCount: state.detectedMarkers.length,
    });
    state.trackedPose = trackerUpdate.trackedPose;
    overlayPose = trackerUpdate.trackedPose;
    poseMessage = `${state.latestPoseResult.poseMode} reproj=${state.latestPoseResult.finalMeanReprojectionErrorPx.toExponential(3)}`;
  } else {
    const missedFrameUpdate = state.poseTracker.updateFromMissedFrame();
    state.trackedPose = missedFrameUpdate.trackedPose;
    overlayPose = missedFrameUpdate.trackedPose;
    poseMessage = `${state.latestPoseResult.stage}:${state.latestPoseResult.reason}`;
  }

  drawOverlay(
    buildOverlayDrawInput(
      domElements,
      state,
      state.detectedMarkers,
      overlayPose,
      aprilCubeConfig.cubeSize,
    ),
  );

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

function handleApplyCalibration(domElements: AppDomElements, state: AppRuntimeState): void {
  const parseResult = parseCalibrationJson(domElements.calibrationJsonInput.value);

  if (!parseResult.success) {
    domElements.calibrationStatusElement.textContent =
      `calibration error: ${parseResult.reason} (${parseResult.detail})`;
    return;
  }

  persistCalibrationJson(domElements.calibrationJsonInput.value.trim());
  state.intrinsicsSource = "calibrated";
  state.distortionCoefficients = parseResult.distortionCoefficients;
  domElements.calibrationStatusElement.textContent =
    "calibration: saved (restart camera to apply)";
}

function handleClearCalibration(domElements: AppDomElements, state: AppRuntimeState): void {
  clearPersistedCalibration();
  domElements.calibrationJsonInput.value = "";
  const resolvedIntrinsics = resolveReferenceCameraIntrinsics();
  state.intrinsicsSource = resolvedIntrinsics.intrinsicsSource;
  state.distortionCoefficients = resolvedIntrinsics.distortionCoefficients;
  domElements.calibrationStatusElement.textContent =
    "calibration: cleared (restart camera to apply)";
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

  domElements.applyCalibrationButton.addEventListener("click", () => {
    handleApplyCalibration(domElements, state);
  });

  domElements.clearCalibrationButton.addEventListener("click", () => {
    handleClearCalibration(domElements, state);
  });

  domElements.wireframeOnlyCheckbox.addEventListener("change", () => {
    redrawCurrentOverlayFrame(domElements, state);
    updateUi(
      domElements,
      state,
      domElements.cameraStatusElement.textContent ?? "not started",
      domElements.resolutionStatusElement.textContent ?? "not checked",
      domElements.detectorStatusElement.textContent ?? "not started",
      domElements.poseStatusElement.textContent ?? "not estimated",
    );
  });

  window.addEventListener("pagehide", () => {
    stopTrackingLoop(state);
    stopCameraStream(state.mediaStream);
  });

  renderCameraResolutionSelectOptions(domElements.cameraResolutionSelect);

  domElements.cameraResolutionSelect.addEventListener("change", () => {
    if (state.lifecycleState !== "idle" && state.lifecycleState !== "failed") {
      return;
    }

    void refreshCameraCaptureOptions(domElements, state);
  });

  updateUi(domElements, state, "not started", "not checked", "not started", "not estimated");
  void refreshCameraCaptureOptions(domElements, state);
}

async function refreshCameraCaptureOptions(
  domElements: AppDomElements,
  state: AppRuntimeState,
): Promise<void> {
  const selectedResolution = readSelectedCameraResolution(domElements.cameraResolutionSelect);

  domElements.cameraFrameRateSelect.dataset.probeComplete = "false";
  domElements.cameraFrameRateHintElement.textContent = `Probing frame rates at ${formatCameraResolutionLabel(selectedResolution)}…`;
  updateUi(
    domElements,
    state,
    domElements.cameraStatusElement.textContent ?? "not started",
    domElements.resolutionStatusElement.textContent ?? "not checked",
    domElements.detectorStatusElement.textContent ?? "not started",
    domElements.poseStatusElement.textContent ?? "not estimated",
  );

  const probeResult = await probeCameraFrameRateOptions(selectedResolution);

  if (probeResult.success) {
    renderCameraFrameRateSelectOptions(
      domElements.cameraFrameRateSelect,
      probeResult.supportedCandidateFrameRates,
    );
  }

  domElements.cameraFrameRateSelect.dataset.probeComplete = "true";
  domElements.cameraFrameRateHintElement.textContent = formatCameraFrameRateProbeMessage(
    probeResult,
    selectedResolution,
  );
  updateUi(
    domElements,
    state,
    domElements.cameraStatusElement.textContent ?? "not started",
    domElements.resolutionStatusElement.textContent ?? "not checked",
    domElements.detectorStatusElement.textContent ?? "not started",
    domElements.poseStatusElement.textContent ?? "not estimated",
  );
}

bindApplication();
