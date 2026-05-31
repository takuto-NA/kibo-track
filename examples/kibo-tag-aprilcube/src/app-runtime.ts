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
import {
  INTRINSICS_REFERENCE_HEIGHT_PIXELS,
  INTRINSICS_REFERENCE_WIDTH_PIXELS,
} from "./constants.js";
import { PoseTracker } from "./pose-tracker.js";
import { resolveReferenceCameraIntrinsics, type IntrinsicsSourceLabel } from "./resolve-reference-intrinsics.js";
import type { KiboTagApriltagInstance } from "./kibo-tag-detector.js";
import type {
  AppLifecycleState,
  CameraFrameRateSelection,
  OverlayDisplayMode,
  ResolutionSnapshot,
} from "./types.js";

export interface AppDomElements {
  readonly startCameraButton: HTMLButtonElement;
  readonly startDetectorButton: HTMLButtonElement;
  readonly cameraResolutionSelect: HTMLSelectElement;
  readonly cameraFrameRateSelect: HTMLSelectElement;
  readonly probeFrameRatesButton: HTMLButtonElement;
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
  requestedCameraResolution: CameraResolutionPixels;
  requestedCameraFrameRateSelection: CameraFrameRateSelection;
  actualCameraFrameRate: number | null;
  cameraFrameRateCapabilityMin: number | null;
  cameraFrameRateCapabilityMax: number | null;
  cameraFrameRateMismatch: boolean;
}

/** Reads required DOM elements for the demo application. */
export function readAppDomElements(): AppDomElements {
  const startCameraButton = document.querySelector<HTMLButtonElement>("#start-camera-button");
  const startDetectorButton = document.querySelector<HTMLButtonElement>("#start-detector-button");
  const cameraResolutionSelect = document.querySelector<HTMLSelectElement>("#camera-resolution-select");
  const cameraFrameRateSelect = document.querySelector<HTMLSelectElement>("#camera-frame-rate-select");
  const probeFrameRatesButton = document.querySelector<HTMLButtonElement>("#probe-frame-rates-button");
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
    probeFrameRatesButton === null ||
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
    probeFrameRatesButton,
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

/** Creates the initial demo runtime state before camera startup. */
export function createInitialAppRuntimeState(): AppRuntimeState {
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
