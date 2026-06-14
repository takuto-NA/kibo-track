/**
 * Application DOM bindings and mutable runtime state for the AprilCube demo.
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
} from "./constants.js";
import { PoseTracker } from "./pose-tracker.js";
import { resolveReferenceCameraIntrinsics, type IntrinsicsSourceLabel } from "./resolve-reference-intrinsics.js";
import type { KiboTagApriltagInstance } from "./kibo-tag-detector.js";
import type { ThreeModelOverlaySession } from "./three-model-overlay.js";
import { DEFAULT_OVERLAY_DISPLAY_MODE } from "./overlay-display-mode.js";
import type { LoadedAprilCubeModelConfig } from "./load-aprilcube-config-file.js";
import {
  createDefaultLoadedAprilCubeModelConfig,
  readDefaultAprilCubeConfigJsonText,
} from "./loaded-aprilcube-model-config.js";
import type {
  AppLifecycleState,
  CameraFacingModeSelection,
  CameraFrameRateSelection,
  OverlayDisplayMode,
  ResolutionSnapshot,
} from "./types.js";

export interface AppDomElements {
  readonly startCameraButton: HTMLButtonElement;
  readonly startDetectorButton: HTMLButtonElement;
  readonly cameraFacingModeSelect: HTMLSelectElement;
  readonly cameraResolutionSelect: HTMLSelectElement;
  readonly cameraFrameRateSelect: HTMLSelectElement;
  readonly probeFrameRatesButton: HTMLButtonElement;
  readonly cameraFrameRateHintElement: HTMLElement;
  readonly cornerOrderSelect: HTMLSelectElement;
  readonly calibrationJsonInput: HTMLTextAreaElement;
  readonly applyCalibrationButton: HTMLButtonElement;
  readonly clearCalibrationButton: HTMLButtonElement;
  readonly calibrationStatusElement: HTMLElement;
  readonly aprilCubeConfigFileInput: HTMLInputElement;
  readonly aprilCubeConfigStatusElement: HTMLElement;
  readonly appStatusElement: HTMLElement;
  readonly cameraStatusElement: HTMLElement;
  readonly resolutionStatusElement: HTMLElement;
  readonly detectorStatusElement: HTMLElement;
  readonly poseStatusElement: HTMLElement;
  readonly diagnosticsTextElement: HTMLElement;
  readonly detectionResultsTextElement: HTMLElement;
  readonly overlayDisplayModeSelect: HTMLSelectElement;
  readonly viewportElement: HTMLElement;
  readonly videoElement: HTMLVideoElement;
  readonly captureCanvas: HTMLCanvasElement;
  readonly overlayCanvas: HTMLCanvasElement;
  readonly threeModelCanvas: HTMLCanvasElement;
}

export interface AppRuntimeState {
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
  threeModelOverlaySession: ThreeModelOverlaySession | null;
  threeModelOverlayLoadPromise: Promise<ThreeModelOverlaySession | null> | null;
  threeModelOverlayLoadError: string | null;
  requestedCameraFacingModeSelection: CameraFacingModeSelection;
  actualCameraFacingMode: CameraFacingModeSelection | null;
  requestedCameraResolution: CameraResolutionPixels;
  requestedCameraFrameRateSelection: CameraFrameRateSelection;
  actualCameraFrameRate: number | null;
  cameraFrameRateCapabilityMin: number | null;
  cameraFrameRateCapabilityMax: number | null;
  cameraFrameRateMismatch: boolean;
  loadedAprilCubeModelConfig: LoadedAprilCubeModelConfig;
  loadedAprilCubeConfigJsonText: string;
  aprilCubeConfigLoadError: string | null;
}

/** Reads required DOM elements for the demo application. */
export function readAppDomElements(): AppDomElements {
  const startCameraButton = document.querySelector<HTMLButtonElement>("#start-camera-button");
  const startDetectorButton = document.querySelector<HTMLButtonElement>("#start-detector-button");
  const cameraFacingModeSelect = document.querySelector<HTMLSelectElement>("#camera-facing-mode-select");
  const cameraResolutionSelect = document.querySelector<HTMLSelectElement>("#camera-resolution-select");
  const cameraFrameRateSelect = document.querySelector<HTMLSelectElement>("#camera-frame-rate-select");
  const probeFrameRatesButton = document.querySelector<HTMLButtonElement>("#probe-frame-rates-button");
  const cameraFrameRateHintElement = document.querySelector<HTMLElement>("#camera-frame-rate-hint");
  const cornerOrderSelect = document.querySelector<HTMLSelectElement>("#corner-order-select");
  const calibrationJsonInput = document.querySelector<HTMLTextAreaElement>("#calibration-json-input");
  const applyCalibrationButton = document.querySelector<HTMLButtonElement>("#apply-calibration-button");
  const clearCalibrationButton = document.querySelector<HTMLButtonElement>("#clear-calibration-button");
  const calibrationStatusElement = document.querySelector<HTMLElement>("#calibration-status");
  const aprilCubeConfigFileInput = document.querySelector<HTMLInputElement>("#aprilcube-config-file-input");
  const aprilCubeConfigStatusElement = document.querySelector<HTMLElement>("#aprilcube-config-status");
  const appStatusElement = document.querySelector<HTMLElement>("#app-status");
  const cameraStatusElement = document.querySelector<HTMLElement>("#camera-status");
  const resolutionStatusElement = document.querySelector<HTMLElement>("#resolution-status");
  const detectorStatusElement = document.querySelector<HTMLElement>("#detector-status");
  const poseStatusElement = document.querySelector<HTMLElement>("#pose-status");
  const diagnosticsTextElement = document.querySelector<HTMLElement>("#diagnostics-text");
  const detectionResultsTextElement = document.querySelector<HTMLElement>("#detection-results-text");
  const overlayDisplayModeSelect = document.querySelector<HTMLSelectElement>("#overlay-display-mode-select");
  const viewportElement = document.querySelector<HTMLElement>("#viewport");
  const videoElement = document.querySelector<HTMLVideoElement>("#camera-video");
  const captureCanvas = document.querySelector<HTMLCanvasElement>("#capture-canvas");
  const overlayCanvas = document.querySelector<HTMLCanvasElement>("#overlay-canvas");
  const threeModelCanvas = document.querySelector<HTMLCanvasElement>("#three-model-canvas");

  if (
    startCameraButton === null ||
    startDetectorButton === null ||
    cameraFacingModeSelect === null ||
    cameraResolutionSelect === null ||
    cameraFrameRateSelect === null ||
    probeFrameRatesButton === null ||
    cameraFrameRateHintElement === null ||
    cornerOrderSelect === null ||
    calibrationJsonInput === null ||
    applyCalibrationButton === null ||
    clearCalibrationButton === null ||
    calibrationStatusElement === null ||
    aprilCubeConfigFileInput === null ||
    aprilCubeConfigStatusElement === null ||
    appStatusElement === null ||
    cameraStatusElement === null ||
    resolutionStatusElement === null ||
    detectorStatusElement === null ||
    poseStatusElement === null ||
    diagnosticsTextElement === null ||
    detectionResultsTextElement === null ||
    overlayDisplayModeSelect === null ||
    viewportElement === null ||
    videoElement === null ||
    captureCanvas === null ||
    overlayCanvas === null ||
    threeModelCanvas === null
  ) {
    throw new Error("Required DOM elements are missing.");
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
    calibrationJsonInput,
    applyCalibrationButton,
    clearCalibrationButton,
    calibrationStatusElement,
    aprilCubeConfigFileInput,
    aprilCubeConfigStatusElement,
    appStatusElement,
    cameraStatusElement,
    resolutionStatusElement,
    detectorStatusElement,
    poseStatusElement,
    diagnosticsTextElement,
    detectionResultsTextElement,
    overlayDisplayModeSelect,
    viewportElement,
    videoElement,
    captureCanvas,
    overlayCanvas,
    threeModelCanvas,
  };
}

/** Creates the initial demo runtime state before camera startup. */
export function createInitialAppRuntimeState(): AppRuntimeState {
  const resolvedIntrinsics = resolveReferenceCameraIntrinsics();
  const defaultLoadedAprilCubeModelConfig = createDefaultLoadedAprilCubeModelConfig();

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
    overlayDisplayMode: DEFAULT_OVERLAY_DISPLAY_MODE,
    threeModelOverlaySession: null,
    threeModelOverlayLoadPromise: null,
    threeModelOverlayLoadError: null,
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
    loadedAprilCubeModelConfig: defaultLoadedAprilCubeModelConfig,
    loadedAprilCubeConfigJsonText: readDefaultAprilCubeConfigJsonText(),
    aprilCubeConfigLoadError: null,
  };
}
