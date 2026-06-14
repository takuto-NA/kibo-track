/**
 * kibo-tag WASM detector wrapper and detection conversion for kibo-track.
 */
import * as Comlink from "comlink";
import type { DetectedMarkerCorners, ImagePoint2D } from "kibo-track";
import {
  KIBO_TAG_ARUCO_BITS_CORRECTED,
  KIBO_TAG_WASM_MODULE_PATH,
  KIBO_TAG_WORKER_SCRIPT_PATH,
  MINIMUM_TAG_DECISION_MARGIN,
} from "./constants.js";
import type { KiboTagDetection, KiboTagDetectorFailureReason } from "./types.js";

/** Minimal kibo-tag Apriltag wrapper surface used by the example. */
export interface KiboTagApriltagInstance {
  set_tag_family(familyName: string, bitsCorrected: number): Promise<void>;
  set_return_pose(returnPose: number): Promise<void>;
  set_return_solutions(returnSolutions: number): Promise<void>;
  set_max_detections(maxDetections: number): Promise<void>;
  detect(
    grayscaleBuffer: Uint8Array,
    imageWidth: number,
    imageHeight: number,
  ): Promise<ReadonlyArray<KiboTagDetection>>;
}

/** Worker-side Apriltag constructor exposed through Comlink. */
type KiboTagApriltagWorkerConstructor = new (
  onDetectorReady: () => void,
) => KiboTagApriltagInstance;

export interface KiboTagDetectorSuccess {
  readonly success: true;
  readonly detector: KiboTagApriltagInstance;
}

export interface KiboTagDetectorFailure {
  readonly success: false;
  readonly reason: KiboTagDetectorFailureReason;
  readonly detail: string;
}

export type KiboTagDetectorLoadResult = KiboTagDetectorSuccess | KiboTagDetectorFailure;

let cachedDetector: KiboTagApriltagInstance | null = null;
let cachedKiboTagFamilyName: string | null = null;

/** Verifies that the kibo-tag WASM bundle is reachable before starting the worker. */
export async function verifyKiboTagWasmModule(
  wasmModulePath: string = KIBO_TAG_WASM_MODULE_PATH,
): Promise<boolean> {
  try {
    const response = await fetch(wasmModulePath, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}

/** Applies the selected ArUco dictionary to an initialized detector instance. */
export async function configureKiboTagDetectorDictionary(
  detector: KiboTagApriltagInstance,
  kiboTagFamilyName: string,
): Promise<void> {
  await detector.set_tag_family(kiboTagFamilyName, KIBO_TAG_ARUCO_BITS_CORRECTED);
  cachedKiboTagFamilyName = kiboTagFamilyName;
}

/** Initializes the kibo-tag detector in a Web Worker via Comlink. */
export async function initializeKiboTagDetector(
  kiboTagFamilyName: string,
): Promise<KiboTagDetectorLoadResult> {
  if (cachedDetector !== null) {
    if (cachedKiboTagFamilyName !== kiboTagFamilyName) {
      await configureKiboTagDetectorDictionary(cachedDetector, kiboTagFamilyName);
    }

    return {
      success: true,
      detector: cachedDetector,
    };
  }

  const wasmModuleAvailable = await verifyKiboTagWasmModule();

  if (!wasmModuleAvailable) {
    return {
      success: false,
      reason: "wasmMissing",
      detail: `Missing kibo-tag WASM module at ${KIBO_TAG_WASM_MODULE_PATH}. Copy apriltag_wasm.js from a kibo-tag build into public/vendor/kibo-tag/.`,
    };
  }

  let detectorReadyResolve: (() => void) | undefined;
  const detectorReadyPromise = new Promise<void>((resolve) => {
    detectorReadyResolve = resolve;
  });

  try {
    const ApriltagWorkerConstructor = Comlink.wrap<KiboTagApriltagWorkerConstructor>(
      new Worker(KIBO_TAG_WORKER_SCRIPT_PATH, { type: "classic" }),
    );

    const detector = await new ApriltagWorkerConstructor(
      Comlink.proxy(() => {
        detectorReadyResolve?.();
      }),
    );

    await detectorReadyPromise;

    await configureKiboTagDetectorDictionary(detector, kiboTagFamilyName);
    await detector.set_return_pose(0);
    await detector.set_return_solutions(0);
    await detector.set_max_detections(0);

    cachedDetector = detector;

    return {
      success: true,
      detector,
    };
  } catch (error) {
    return {
      success: false,
      reason: "detectorNotReady",
      detail: error instanceof Error ? error.message : "Detector initialization failed.",
    };
  }
}

/** Converts kibo-tag detections into kibo-track DetectedMarkerCorners. */
export function convertKiboTagDetectionsToMarkerCorners(
  detections: ReadonlyArray<KiboTagDetection>,
  configuredTagIdSet: ReadonlySet<number>,
  minimumDecisionMargin: number = MINIMUM_TAG_DECISION_MARGIN,
): DetectedMarkerCorners[] {
  const markerCorners: DetectedMarkerCorners[] = [];

  for (const detection of detections) {
    if (!configuredTagIdSet.has(detection.id)) {
      continue;
    }

    if (
      detection.decision_margin !== undefined &&
      detection.decision_margin < minimumDecisionMargin
    ) {
      continue;
    }

    if (detection.corners.length !== 4) {
      continue;
    }

    const corners: ImagePoint2D[] = detection.corners.map((corner) => [corner.x, corner.y]);
    markerCorners.push({
      id: detection.id,
      corners,
    });
  }

  return markerCorners;
}

/** Runs kibo-tag detection and converts the output for kibo-track. */
export async function detectAprilCubeMarkers(
  detector: KiboTagApriltagInstance,
  grayscaleBuffer: Uint8Array,
  imageWidth: number,
  imageHeight: number,
  configuredTagIdSet: ReadonlySet<number>,
): Promise<DetectedMarkerCorners[]> {
  const detections = await detector.detect(grayscaleBuffer, imageWidth, imageHeight);
  return convertKiboTagDetectionsToMarkerCorners(detections, configuredTagIdSet);
}

/** Clears cached detector state after config changes that require a fresh worker. */
export function resetCachedKiboTagDetector(): void {
  cachedDetector = null;
  cachedKiboTagFamilyName = null;
}
