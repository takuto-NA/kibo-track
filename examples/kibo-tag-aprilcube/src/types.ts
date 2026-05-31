/**
 * Shared types for the kibo-tag AprilCube browser example.
 */
import type { AprilCubeCornerOrderName, CameraIntrinsics } from "kibo-track";

/** Application lifecycle states exposed in the UI. */
export type AppLifecycleState =
  | "idle"
  | "startingCamera"
  | "cameraReady"
  | "resolutionReady"
  | "loadingDetector"
  | "detectorReady"
  | "tracking"
  | "failed";

/** Recoverable camera startup failure reasons. */
export type CameraStartupFailureReason =
  | "insecureContext"
  | "mediaDevicesUnavailable"
  | "noVideoInput"
  | "permissionDenied"
  | "deviceBusyOrUnavailable"
  | "metadataTimeout"
  | "emptyFrame";

/**
 * Camera frame-rate choice from the UI.
 * Explicit values are numeric fps strings discovered via getCapabilities probing.
 */
export type CameraFrameRateSelection = "deviceDefault" | `${number}`;

/** Camera facing direction for getUserMedia (`user` = front, `environment` = back). */
export type CameraFacingModeSelection = "environment" | "user";

/** Successful camera startup result. */
export interface CameraStartupSuccess {
  readonly success: true;
  readonly mediaStream: MediaStream;
  readonly videoWidth: number;
  readonly videoHeight: number;
  readonly cameraLabel: string | null;
  readonly requestedFrameRateSelection: CameraFrameRateSelection;
  readonly requestedResolutionWidthPixels: number;
  readonly requestedResolutionHeightPixels: number;
  readonly actualFrameRate: number | null;
  readonly capabilityMinFrameRate: number | null;
  readonly capabilityMaxFrameRate: number | null;
  readonly frameRateMismatch: boolean;
  readonly requestedFacingModeSelection: CameraFacingModeSelection;
  readonly actualFacingMode: CameraFacingModeSelection | null;
}

/** Failed camera startup result. */
export interface CameraStartupFailure {
  readonly success: false;
  readonly reason: CameraStartupFailureReason;
  readonly detail: string;
}

/** Result of camera startup gate. */
export type CameraStartupResult = CameraStartupSuccess | CameraStartupFailure;

/** Recoverable resolution gate failure reasons. */
export type ResolutionGateFailureReason =
  | "videoResolutionUnavailable"
  | "captureCanvasMismatch"
  | "detectorDimensionMismatch"
  | "overlayCanvasMismatch"
  | "intrinsicsReferenceMismatch"
  | "cssPixelCoordinateLeak";

/** Resolution snapshot used for diagnostics and validation. */
export interface ResolutionSnapshot {
  readonly videoWidth: number;
  readonly videoHeight: number;
  readonly captureCanvasWidth: number;
  readonly captureCanvasHeight: number;
  readonly overlayCanvasWidth: number;
  readonly overlayCanvasHeight: number;
  readonly overlayCssWidth: number;
  readonly overlayCssHeight: number;
  readonly devicePixelRatio: number;
  readonly grayscaleBufferLength: number;
  readonly intrinsicsReferenceWidth: number;
  readonly intrinsicsReferenceHeight: number;
}

/** Successful resolution gate result. */
export interface ResolutionGateSuccess {
  readonly success: true;
  readonly snapshot: ResolutionSnapshot;
  readonly scaledCameraIntrinsics: CameraIntrinsics;
  readonly intrinsicsArePlaceholder: boolean;
}

/** Failed resolution gate result. */
export interface ResolutionGateFailure {
  readonly success: false;
  readonly reason: ResolutionGateFailureReason;
  readonly detail: string;
}

/** Result of resolution consistency gate. */
export type ResolutionGateResult = ResolutionGateSuccess | ResolutionGateFailure;

/** kibo-tag detection corner in pixel coordinates. */
export interface KiboTagDetectionCorner {
  readonly x: number;
  readonly y: number;
}

/** kibo-tag detection object shape used by the example adapter. */
export interface KiboTagDetection {
  readonly id: number;
  readonly corners: ReadonlyArray<KiboTagDetectionCorner>;
  readonly decision_margin?: number;
}

/** Recoverable kibo-tag detector failure reasons. */
export type KiboTagDetectorFailureReason =
  | "scriptLoadFailed"
  | "wasmMissing"
  | "detectorNotReady"
  | "detectFailed";

/** AprilCube layout JSON from the printed cube configuration. */
export interface AprilCubeLayoutJson {
  readonly dict: string;
  readonly grid: string;
  readonly tag_ids: ReadonlyArray<number>;
  readonly faces: Readonly<Record<string, ReadonlyArray<number>>>;
  readonly tag_size_mm: number;
  readonly cell_size_mm: number;
  readonly margin_cells: number;
  readonly border_cells: number;
  readonly marker_pixels: number;
  readonly box_dims: Readonly<[number, number, number]>;
}

/** Camera intrinsics declared at a known reference resolution. */
export interface ReferenceCameraIntrinsics {
  readonly referenceWidth: number;
  readonly referenceHeight: number;
  readonly intrinsics: CameraIntrinsics;
  readonly isPlaceholder: boolean;
}

/** UI corner order selection value. */
export type CornerOrderSelection = AprilCubeCornerOrderName;

/** Viewport overlay rendering mode. */
export type OverlayDisplayMode =
  | "cameraWithWireframe"
  | "wireframeOnly"
  | "cameraWithModel"
  | "modelOnly";
