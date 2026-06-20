/**
 * DOM bindings and mutable runtime state for the 16-cube AprilCube demo.
 */
import type {
  CameraIntrinsics,
  DetectedMarkerCorners,
  EstimateAprilCubePoseResult,
  Pose,
} from "kibo-track";
import type { CameraResolutionPixels } from "./camera-resolution.js";
import { DEFAULT_CAMERA_FACING_MODE_SELECTION } from "./camera-facing-mode.js";
import {
  INTRINSICS_REFERENCE_HEIGHT_PIXELS,
  INTRINSICS_REFERENCE_WIDTH_PIXELS,
  MULTI_CUBE_CONFIG_COUNT,
} from "./constants.js";
import { PoseTracker, type PoseTrackerSnapshot, type PoseTrackerState } from "./pose-tracker.js";
import {
  resolveReferenceCameraIntrinsics,
  type IntrinsicsSourceLabel,
} from "./resolve-reference-intrinsics.js";
import type { KiboTagApriltagInstance } from "./kibo-tag-detector.js";
import { DEFAULT_OVERLAY_DISPLAY_MODE } from "./overlay-display-mode.js";
import type { MultiCubeConfigSet } from "./multi-cube-config.js";
import type {
  AppLifecycleState,
  CameraFacingModeSelection,
  CameraFrameRateSelection,
  OverlayDisplayMode,
  ResolutionSnapshot,
} from "./types.js";

/** Per-cube tracking snapshot shown in the UI grid. */
export interface MultiCubePerCubeStatus {
  readonly cubeIndex: number;
  readonly configLabel: string;
  readonly tagIds: ReadonlyArray<number>;
  readonly trackerState: PoseTrackerState;
  readonly coastFrameCount: number;
  readonly detectedMarkerCount: number;
  readonly poseMode: string;
  readonly reprojectionErrorPx: number | null;
  readonly poseFailureReason: string | null;
}

export interface MultiCubeAppDomElements {
  readonly startCameraButton: HTMLButtonElement;
  readonly startDetectorButton: HTMLButtonElement;
  readonly cameraFacingModeSelect: HTMLSelectElement;
  readonly cameraResolutionSelect: HTMLSelectElement;
  readonly cameraFrameRateSelect: HTMLSelectElement;
  readonly probeFrameRatesButton: HTMLButtonElement;
  readonly cameraFrameRateHintElement: HTMLElement;
  readonly cornerOrderSelect: HTMLSelectElement;
  readonly loadConfigsButton: HTMLButtonElement;
  readonly calibrationJsonInput: HTMLTextAreaElement;
  readonly applyCalibrationButton: HTMLButtonElement;
  readonly clearCalibrationButton: HTMLButtonElement;
  readonly calibrationStatusElement: HTMLElement;
  readonly multiCubeConfigStatusElement: HTMLElement;
  readonly appStatusElement: HTMLElement;
  readonly cameraStatusElement: HTMLElement;
  readonly resolutionStatusElement: HTMLElement;
  readonly detectorStatusElement: HTMLElement;
  readonly poseStatusElement: HTMLElement;
  readonly diagnosticsTextElement: HTMLElement;
  readonly detectedMarkersTextElement: HTMLElement;
  readonly perCubeStatusGridElement: HTMLElement;
  readonly overlayDisplayModeSelect: HTMLSelectElement;
  readonly viewportElement: HTMLElement;
  readonly videoElement: HTMLVideoElement;
  readonly captureCanvas: HTMLCanvasElement;
  readonly overlayCanvas: HTMLCanvasElement;
}

export interface MultiCubeAppRuntimeState {
  lifecycleState: AppLifecycleState;
  mediaStream: MediaStream | null;
  detector: KiboTagApriltagInstance | null;
  scaledCameraIntrinsics: CameraIntrinsics | null;
  resolutionSnapshot: ResolutionSnapshot | null;
  intrinsicsSource: IntrinsicsSourceLabel;
  distortionCoefficients: readonly number[];
  detectedMarkers: DetectedMarkerCorners[];
  latestPoseResults: ReadonlyArray<EstimateAprilCubePoseResult | null>;
  trackedPoses: ReadonlyArray<Pose | null>;
  poseTrackers: ReadonlyArray<PoseTracker>;
  perCubeDetectedMarkerCounts: ReadonlyArray<number>;
  perCubeStatuses: ReadonlyArray<MultiCubePerCubeStatus>;
  animationFrameIdentifier: number | null;
  isProcessingTrackingFrame: boolean;
  overlayDisplayMode: OverlayDisplayMode;
  requestedCameraFacingModeSelection: CameraFacingModeSelection;
  actualCameraFacingMode: CameraFacingModeSelection | null;
  requestedCameraResolution: CameraResolutionPixels;
  requestedCameraFrameRateSelection: CameraFrameRateSelection;
  actualCameraFrameRate: number | null;
  cameraFrameRateCapabilityMin: number | null;
  cameraFrameRateCapabilityMax: number | null;
  cameraFrameRateMismatch: boolean;
  multiCubeConfigSet: MultiCubeConfigSet | null;
  multiCubeConfigLoadError: string | null;
  multiCubeConfigLoading: boolean;
}

/** Reads required DOM elements for the multi-cube demo application. */
export function readMultiCubeAppDomElements(): MultiCubeAppDomElements {
  const startCameraButton = document.querySelector<HTMLButtonElement>("#start-camera-button");
  const startDetectorButton = document.querySelector<HTMLButtonElement>("#start-detector-button");
  const cameraFacingModeSelect = document.querySelector<HTMLSelectElement>("#camera-facing-mode-select");
  const cameraResolutionSelect = document.querySelector<HTMLSelectElement>("#camera-resolution-select");
  const cameraFrameRateSelect = document.querySelector<HTMLSelectElement>("#camera-frame-rate-select");
  const probeFrameRatesButton = document.querySelector<HTMLButtonElement>("#probe-frame-rates-button");
  const cameraFrameRateHintElement = document.querySelector<HTMLElement>("#camera-frame-rate-hint");
  const cornerOrderSelect = document.querySelector<HTMLSelectElement>("#corner-order-select");
  const loadConfigsButton = document.querySelector<HTMLButtonElement>("#load-multi-cube-configs-button");
  const calibrationJsonInput = document.querySelector<HTMLTextAreaElement>("#calibration-json-input");
  const applyCalibrationButton = document.querySelector<HTMLButtonElement>("#apply-calibration-button");
  const clearCalibrationButton = document.querySelector<HTMLButtonElement>("#clear-calibration-button");
  const calibrationStatusElement = document.querySelector<HTMLElement>("#calibration-status");
  const multiCubeConfigStatusElement = document.querySelector<HTMLElement>("#multi-cube-config-status");
  const appStatusElement = document.querySelector<HTMLElement>("#app-status");
  const cameraStatusElement = document.querySelector<HTMLElement>("#camera-status");
  const resolutionStatusElement = document.querySelector<HTMLElement>("#resolution-status");
  const detectorStatusElement = document.querySelector<HTMLElement>("#detector-status");
  const poseStatusElement = document.querySelector<HTMLElement>("#pose-status");
  const diagnosticsTextElement = document.querySelector<HTMLElement>("#diagnostics-text");
  const detectedMarkersTextElement = document.querySelector<HTMLElement>("#detected-markers-text");
  const perCubeStatusGridElement = document.querySelector<HTMLElement>("#per-cube-status-grid");
  const overlayDisplayModeSelect = document.querySelector<HTMLSelectElement>("#overlay-display-mode-select");
  const viewportElement = document.querySelector<HTMLElement>("#viewport");
  const videoElement = document.querySelector<HTMLVideoElement>("#camera-video");
  const captureCanvas = document.querySelector<HTMLCanvasElement>("#capture-canvas");
  const overlayCanvas = document.querySelector<HTMLCanvasElement>("#overlay-canvas");

  if (
    startCameraButton === null ||
    startDetectorButton === null ||
    cameraFacingModeSelect === null ||
    cameraResolutionSelect === null ||
    cameraFrameRateSelect === null ||
    probeFrameRatesButton === null ||
    cameraFrameRateHintElement === null ||
    cornerOrderSelect === null ||
    loadConfigsButton === null ||
    calibrationJsonInput === null ||
    applyCalibrationButton === null ||
    clearCalibrationButton === null ||
    calibrationStatusElement === null ||
    multiCubeConfigStatusElement === null ||
    appStatusElement === null ||
    cameraStatusElement === null ||
    resolutionStatusElement === null ||
    detectorStatusElement === null ||
    poseStatusElement === null ||
    diagnosticsTextElement === null ||
    detectedMarkersTextElement === null ||
    perCubeStatusGridElement === null ||
    overlayDisplayModeSelect === null ||
    viewportElement === null ||
    videoElement === null ||
    captureCanvas === null ||
    overlayCanvas === null
  ) {
    throw new Error("Required DOM elements are missing for multi-cube demo.");
  }

  return {
    startCameraButton,
    startDetectorButton,
    cameraFacingModeSelect,
    cameraResolutionSelect,
    cameraFrameRateSelect,
    probeFrameRatesButton,
    cameraFrameRateHintElement,
    cornerOrderSelect,
    loadConfigsButton,
    calibrationJsonInput,
    applyCalibrationButton,
    clearCalibrationButton,
    calibrationStatusElement,
    multiCubeConfigStatusElement,
    appStatusElement,
    cameraStatusElement,
    resolutionStatusElement,
    detectorStatusElement,
    poseStatusElement,
    diagnosticsTextElement,
    detectedMarkersTextElement,
    perCubeStatusGridElement,
    overlayDisplayModeSelect,
    viewportElement,
    videoElement,
    captureCanvas,
    overlayCanvas,
  };
}

/** Builds the initial 16-cube per-cube status rows before any configs load. */
export function buildInitialPerCubeStatuses(): ReadonlyArray<MultiCubePerCubeStatus> {
  const statuses: MultiCubePerCubeStatus[] = [];

  for (let i = 0; i < MULTI_CUBE_CONFIG_COUNT; i += 1) {
    statuses.push({
      cubeIndex: i,
      configLabel: "(not loaded)",
      tagIds: [],
      trackerState: "lost",
      coastFrameCount: 0,
      detectedMarkerCount: 0,
      poseMode: "—",
      reprojectionErrorPx: null,
      poseFailureReason: null,
    });
  }

  return statuses;
}

/** Resets all 16 pose trackers. */
export function resetAllPoseTrackers(trackers: ReadonlyArray<PoseTracker>): void {
  for (const tracker of trackers) {
    tracker.reset();
  }
}

/** Resets per-cube tracking arrays (poses, results, trackers) to a lost state. */
export function resetMultiCubeTrackingState(state: MultiCubeAppRuntimeState): void {
  resetAllPoseTrackers(state.poseTrackers);
  state.trackedPoses = new Array(MULTI_CUBE_CONFIG_COUNT).fill(null);
  state.latestPoseResults = new Array(MULTI_CUBE_CONFIG_COUNT).fill(null);
  state.perCubeDetectedMarkerCounts = new Array(MULTI_CUBE_CONFIG_COUNT).fill(0);
  state.perCubeStatuses = buildInitialPerCubeStatuses();
}

/** Returns pose tracker snapshots for diagnostics. */
export function readMultiCubeTrackerSnapshots(
  trackers: ReadonlyArray<PoseTracker>,
): ReadonlyArray<PoseTrackerSnapshot> {
  return trackers.map((tracker) => tracker.getSnapshot());
}

/** Creates the initial multi-cube demo runtime state before camera startup. */
export function createInitialMultiCubeAppRuntimeState(): MultiCubeAppRuntimeState {
  const resolvedIntrinsics = resolveReferenceCameraIntrinsics();
  const poseTrackers: PoseTracker[] = Array.from(
    { length: MULTI_CUBE_CONFIG_COUNT },
    () => new PoseTracker(),
  );

  return {
    lifecycleState: "idle",
    mediaStream: null,
    detector: null,
    scaledCameraIntrinsics: null,
    resolutionSnapshot: null,
    intrinsicsSource: resolvedIntrinsics.intrinsicsSource,
    distortionCoefficients: resolvedIntrinsics.distortionCoefficients,
    detectedMarkers: [],
    latestPoseResults: new Array(MULTI_CUBE_CONFIG_COUNT).fill(null),
    trackedPoses: new Array(MULTI_CUBE_CONFIG_COUNT).fill(null),
    poseTrackers,
    perCubeDetectedMarkerCounts: new Array(MULTI_CUBE_CONFIG_COUNT).fill(0),
    perCubeStatuses: buildInitialPerCubeStatuses(),
    animationFrameIdentifier: null,
    isProcessingTrackingFrame: false,
    overlayDisplayMode: DEFAULT_OVERLAY_DISPLAY_MODE,
    requestedCameraFacingModeSelection: DEFAULT_CAMERA_FACING_MODE_SELECTION,
    actualCameraFacingMode: null,
    requestedCameraResolution: {
      widthPixels: INTRINSICS_REFERENCE_WIDTH_PIXELS,
      heightPixels: INTRINSICS_REFERENCE_HEIGHT_PIXELS,
    },
    requestedCameraFrameRateSelection: "deviceDefault",
    actualCameraFrameRate: null,
    cameraFrameRateCapabilityMin: null,
    cameraFrameRateCapabilityMax: null,
    cameraFrameRateMismatch: false,
    multiCubeConfigSet: null,
    multiCubeConfigLoadError: null,
    multiCubeConfigLoading: false,
  };
}
