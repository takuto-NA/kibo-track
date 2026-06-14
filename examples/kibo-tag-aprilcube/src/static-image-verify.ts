/**
 * Static AprilCube image verification: detect markers, estimate pose, draw wireframe overlay.
 */
import { estimateAprilCubePose, type AprilCubeConfig } from "kibo-track";
import type {
  DetectedMarkerCorners,
  EstimateAprilCubePoseSuccess,
} from "kibo-track";
import { loadAprilCubeConfigFromUrl } from "./load-aprilcube-config-file.js";
import { createDefaultLoadedAprilCubeModelConfig } from "./loaded-aprilcube-model-config.js";
import { createPlaceholderReferenceCameraIntrinsics } from "./reference-intrinsics.js";
import { scaleCameraIntrinsicsToCaptureResolution } from "./resolution-gate.js";
import { parseCalibrationJson } from "./parse-calibration-json.js";
import { undistortDetectedMarkers } from "./camera-distortion.js";
import { captureImageElementToGrayscale, loadImageFromUrl } from "./image-file-capture.js";
import {
  detectAprilCubeMarkers,
  initializeKiboTagDetector,
} from "./kibo-tag-detector.js";
import { drawOverlay } from "./overlay.js";
import { readCornerOrderFromQueryValue } from "./read-corner-order-selection.js";

export interface StaticImageVerificationResult {
  readonly status: "complete" | "failed";
  readonly imageUrl: string;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly detectedMarkerCount: number;
  readonly detectedMarkerIds: readonly number[];
  readonly poseSuccess: boolean;
  readonly poseMode: string | null;
  readonly finalReprojectionErrorPx: number | null;
  readonly visibleFaceCount: number | null;
  readonly failureReason: string | null;
  readonly rejectedMarkerIds?: readonly number[];
  readonly detectedMarkers?: readonly DetectedMarkerCorners[];
  readonly markerReprojectionDiagnostics?: EstimateAprilCubePoseSuccess["markerReprojectionDiagnostics"];
  readonly poseTranslation?: readonly [number, number, number];
}

declare global {
  interface Window {
    __staticImageVerificationResult?: StaticImageVerificationResult;
  }
}

function readImageUrlFromQueryString(): string {
  const imageUrl = new URLSearchParams(window.location.search).get("image");

  if (imageUrl === null || imageUrl.trim().length === 0) {
    throw new Error("Missing ?image= query parameter.");
  }

  return imageUrl;
}

async function readAprilCubeConfigFromQueryString(
  cornerOrder: ReturnType<typeof readCornerOrderFromQueryValue>,
): Promise<{
  readonly aprilCubeConfig: AprilCubeConfig;
  readonly tagIds: readonly number[];
  readonly configuredTagIdSet: ReadonlySet<number>;
  readonly boxDimensionsMeters: readonly [number, number, number];
  readonly kiboTagFamilyName: string;
}> {
  const configUrl = new URLSearchParams(window.location.search).get("config");
  const defaultLoadedConfig = createDefaultLoadedAprilCubeModelConfig(cornerOrder);

  if (configUrl === null || configUrl.trim().length === 0) {
    return {
      aprilCubeConfig: defaultLoadedConfig.aprilCubeConfig,
      tagIds: defaultLoadedConfig.tagIds,
      configuredTagIdSet: defaultLoadedConfig.configuredTagIdSet,
      boxDimensionsMeters: defaultLoadedConfig.boxDimensionsMeters,
      kiboTagFamilyName: defaultLoadedConfig.kiboTagFamilyName,
    };
  }

  const loadResult = await loadAprilCubeConfigFromUrl(configUrl, cornerOrder);

  if (!loadResult.success) {
    throw new Error(loadResult.detail);
  }

  return {
    aprilCubeConfig: loadResult.loadedConfig.aprilCubeConfig,
    tagIds: loadResult.loadedConfig.tagIds,
    configuredTagIdSet: loadResult.loadedConfig.configuredTagIdSet,
    boxDimensionsMeters: loadResult.loadedConfig.boxDimensionsMeters,
    kiboTagFamilyName: loadResult.loadedConfig.kiboTagFamilyName,
  };
}

async function readCalibrationFromQueryString(
  captureWidth: number,
  captureHeight: number,
): Promise<{
  readonly cameraIntrinsics: ReturnType<typeof scaleCameraIntrinsicsToCaptureResolution>;
  readonly distortionCoefficients: readonly number[];
} | null> {
  const calibrationUrl = new URLSearchParams(window.location.search).get("calibration");

  if (calibrationUrl === null || calibrationUrl.trim().length === 0) {
    return null;
  }

  const response = await fetch(calibrationUrl);
  const calibrationText = await response.text();
  const parseResult = parseCalibrationJson(calibrationText);

  if (!parseResult.success) {
    throw new Error(`Invalid calibration JSON: ${parseResult.reason}`);
  }

  return {
    cameraIntrinsics: scaleCameraIntrinsicsToCaptureResolution(
      parseResult.referenceCameraIntrinsics,
      captureWidth,
      captureHeight,
    ),
    distortionCoefficients: parseResult.distortionCoefficients,
  };
}

function writeVerificationOutput(
  statusElement: HTMLElement,
  diagnosticsElement: HTMLElement,
  result: StaticImageVerificationResult,
): void {
  statusElement.textContent = result.status;
  diagnosticsElement.textContent = JSON.stringify(result, null, 2);
  window.__staticImageVerificationResult = result;
}

async function runStaticImageVerification(): Promise<void> {
  const statusElement = document.querySelector<HTMLElement>("#verify-status");
  const diagnosticsElement = document.querySelector<HTMLElement>("#verify-diagnostics");
  const captureCanvas = document.querySelector<HTMLCanvasElement>("#capture-canvas");
  const overlayCanvas = document.querySelector<HTMLCanvasElement>("#overlay-canvas");

  if (
    statusElement === null ||
    diagnosticsElement === null ||
    captureCanvas === null ||
    overlayCanvas === null
  ) {
    throw new Error("Verification page DOM is incomplete.");
  }

  const imageUrl = readImageUrlFromQueryString();
  statusElement.textContent = "loading-image";

  const imageElement = await loadImageFromUrl(imageUrl);
  const frameCapture = captureImageElementToGrayscale(imageElement, captureCanvas);

  if (frameCapture === null) {
    writeVerificationOutput(statusElement, diagnosticsElement, {
      status: "failed",
      imageUrl,
      imageWidth: 0,
      imageHeight: 0,
      detectedMarkerCount: 0,
      detectedMarkerIds: [],
      poseSuccess: false,
      poseMode: null,
      finalReprojectionErrorPx: null,
      visibleFaceCount: null,
      failureReason: "imageCaptureFailed",
    });
    return;
  }

  overlayCanvas.width = frameCapture.captureWidth;
  overlayCanvas.height = frameCapture.captureHeight;

  statusElement.textContent = "loading-detector";
  const queryParameters = new URLSearchParams(window.location.search);
  const cornerOrder = readCornerOrderFromQueryValue(queryParameters.get("cornerOrder"));
  const loadedAprilCubeConfig = await readAprilCubeConfigFromQueryString(cornerOrder);
  const detectorLoadResult = await initializeKiboTagDetector(
    loadedAprilCubeConfig.kiboTagFamilyName,
  );

  if (!detectorLoadResult.success) {
    writeVerificationOutput(statusElement, diagnosticsElement, {
      status: "failed",
      imageUrl,
      imageWidth: frameCapture.captureWidth,
      imageHeight: frameCapture.captureHeight,
      detectedMarkerCount: 0,
      detectedMarkerIds: [],
      poseSuccess: false,
      poseMode: null,
      finalReprojectionErrorPx: null,
      visibleFaceCount: null,
      failureReason: `${detectorLoadResult.reason}:${detectorLoadResult.detail}`,
    });
    return;
  }

  statusElement.textContent = "detecting";
  const detectedMarkers = await detectAprilCubeMarkers(
    detectorLoadResult.detector,
    frameCapture.grayscaleBuffer,
    frameCapture.captureWidth,
    frameCapture.captureHeight,
    loadedAprilCubeConfig.configuredTagIdSet,
  );

  const scaledCameraIntrinsics = scaleCameraIntrinsicsToCaptureResolution(
    createPlaceholderReferenceCameraIntrinsics(),
    frameCapture.captureWidth,
    frameCapture.captureHeight,
  );
  const calibratedCamera = await readCalibrationFromQueryString(
    frameCapture.captureWidth,
    frameCapture.captureHeight,
  );
  const focalLengthOverrideText = queryParameters.get("focalLengthPixels");
  const focalLengthOverride =
    focalLengthOverrideText === null ? null : Number(focalLengthOverrideText);
  const cameraIntrinsics =
    calibratedCamera?.cameraIntrinsics ??
    (focalLengthOverride !== null &&
    Number.isFinite(focalLengthOverride) &&
    focalLengthOverride > 0
      ? {
          focalLengthX: focalLengthOverride,
          focalLengthY: focalLengthOverride,
          principalPointX: frameCapture.captureWidth / 2,
          principalPointY: frameCapture.captureHeight / 2,
        }
      : scaledCameraIntrinsics);
  const distortionCoefficients = calibratedCamera?.distortionCoefficients ?? [];
  const aprilCubeConfig = loadedAprilCubeConfig.aprilCubeConfig;
  const poseEstimationMarkers = undistortDetectedMarkers(
    detectedMarkers,
    cameraIntrinsics,
    distortionCoefficients,
  );

  statusElement.textContent = "estimating-pose";
  const poseResult = estimateAprilCubePose(
    {
      markers: poseEstimationMarkers,
      config: aprilCubeConfig,
      cameraIntrinsics: cameraIntrinsics,
    },
    { enableRansac: detectedMarkers.length > 2 },
  );

  drawOverlay({
    overlayCanvas,
    captureCanvas,
    detectedMarkers,
    pose: poseResult.success ? poseResult.pose : null,
    boxDimensionsMeters: loadedAprilCubeConfig.boxDimensionsMeters,
    cameraIntrinsics: cameraIntrinsics,
    distortionCoefficients,
  });

  if (!poseResult.success) {
    writeVerificationOutput(statusElement, diagnosticsElement, {
      status: "failed",
      imageUrl,
      imageWidth: frameCapture.captureWidth,
      imageHeight: frameCapture.captureHeight,
      detectedMarkerCount: detectedMarkers.length,
      detectedMarkerIds: detectedMarkers.map((marker) => marker.id),
      poseSuccess: false,
      poseMode: null,
      finalReprojectionErrorPx: null,
      visibleFaceCount: null,
      failureReason: `${poseResult.stage}:${poseResult.reason}`,
      detectedMarkers,
    });
    return;
  }

  writeVerificationOutput(statusElement, diagnosticsElement, {
    status: "complete",
    imageUrl,
    imageWidth: frameCapture.captureWidth,
    imageHeight: frameCapture.captureHeight,
    detectedMarkerCount: detectedMarkers.length,
    detectedMarkerIds: detectedMarkers.map((marker) => marker.id),
    poseSuccess: true,
    poseMode: poseResult.poseMode,
    finalReprojectionErrorPx: poseResult.finalMeanReprojectionErrorPx,
    visibleFaceCount: poseResult.visibleFaceCount,
    failureReason: null,
    rejectedMarkerIds: poseResult.rejectedMarkerIds,
    detectedMarkers,
    markerReprojectionDiagnostics: poseResult.markerReprojectionDiagnostics,
    poseTranslation: poseResult.pose.translation,
  });
}

void runStaticImageVerification().catch((error: unknown) => {
  const statusElement = document.querySelector<HTMLElement>("#verify-status");
  const diagnosticsElement = document.querySelector<HTMLElement>("#verify-diagnostics");

  if (statusElement === null || diagnosticsElement === null) {
    throw error;
  }

  writeVerificationOutput(statusElement, diagnosticsElement, {
    status: "failed",
    imageUrl: "",
    imageWidth: 0,
    imageHeight: 0,
    detectedMarkerCount: 0,
    detectedMarkerIds: [],
    poseSuccess: false,
    poseMode: null,
    finalReprojectionErrorPx: null,
    visibleFaceCount: null,
    failureReason: error instanceof Error ? error.message : "unknownError",
  });
});
