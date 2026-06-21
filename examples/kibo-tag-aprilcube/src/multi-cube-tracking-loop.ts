/**
 * Camera-frame tracking loop for the 16-cube AprilCube demo: detect, partition, estimate, draw.
 */
import { estimateAprilCubePose, type Pose } from "kibo-track";
import { captureVideoFrameToGrayscale } from "./camera.js";
import { undistortDetectedMarkers } from "./camera-distortion.js";
import { detectAprilCubeMarkers } from "./kibo-tag-detector.js";
import { partitionDetectedMarkersByCubeIndex } from "./multi-cube-config.js";
import { drawMultiCubeOverlay } from "./multi-cube-overlay.js";
import {
  createMultiCubeThreeOverlay,
  renderMultiCubeThreeOverlay,
  disposeMultiCubeThreeOverlay,
  type MultiCubeThreeOverlaySession,
} from "./multi-cube-3d-overlay.js";
import { MULTI_CUBE_CONFIG_COUNT } from "./constants.js";
import type {
  MultiCubeAppDomElements,
  MultiCubeAppRuntimeState,
  MultiCubePerCubeStatus,
} from "./multi-cube-runtime.js";
import { updateMultiCubeAppUi } from "./multi-cube-ui-text.js";
import type { DetectedMarkerCorners } from "kibo-track";

function cancelMultiCubeTrackingLoop(state: MultiCubeAppRuntimeState): void {
  if (state.animationFrameIdentifier !== null) {
    cancelAnimationFrame(state.animationFrameIdentifier);
    state.animationFrameIdentifier = null;
  }
}

type EstimateAprilCubeResult = ReturnType<typeof estimateAprilCubePose>;

/** Processes one cube's partition: pose estimation + tracker update, returning updated pose. */
function processOneCube(
  cubeIndex: number,
  cubeMarkers: DetectedMarkerCorners[],
  state: MultiCubeAppRuntimeState,
): {
  readonly trackedPose: Pose | null;
  readonly latestResult: EstimateAprilCubeResult | null;
} {
  const tracker = state.poseTrackers[cubeIndex]!;

  if (cubeMarkers.length === 0) {
    const missed = tracker.updateFromMissedFrame();
    return {
      trackedPose: missed.trackedPose,
      latestResult: null,
    };
  }

  const configSet = state.multiCubeConfigSet;

  if (configSet === null || state.scaledCameraIntrinsics === null) {
    return { trackedPose: null, latestResult: null };
  }

  const cubeConfig = configSet.cubes[cubeIndex]!;

  const poseEstimationMarkers = undistortDetectedMarkers(
    cubeMarkers,
    state.scaledCameraIntrinsics,
    state.distortionCoefficients,
  );

  const previousPose = state.trackedPoses[cubeIndex] ?? undefined;

  const poseResult = estimateAprilCubePose(
    {
      markers: poseEstimationMarkers,
      config: cubeConfig.aprilCubeConfig,
      cameraIntrinsics: state.scaledCameraIntrinsics,
    },
    {
      enableRansac: true,
      previousPose,
    },
  );

  if (poseResult.success) {
    const trackerUpdate = tracker.updateFromMeasurement({
      pose: poseResult.pose,
      finalMeanReprojectionErrorPx: poseResult.finalMeanReprojectionErrorPx,
      detectedMarkerCount: cubeMarkers.length,
      poseMode: poseResult.poseMode,
      visibleFaceCount: poseResult.visibleFaceCount,
    });

    return {
      trackedPose: trackerUpdate.trackedPose,
      latestResult: poseResult,
    };
  }

  const missed = tracker.updateFromMissedFrame();

  return {
    trackedPose: missed.trackedPose,
    latestResult: poseResult,
  };
}

/** Builds the per-cube status rows for the UI grid from the current tracking state. */
export function buildPerCubeStatusesFromState(
  state: MultiCubeAppRuntimeState,
): ReadonlyArray<MultiCubePerCubeStatus> {
  const configSet = state.multiCubeConfigSet;

  return state.poseTrackers.map((tracker, cubeIndex) => {
    const snapshot = tracker.getSnapshot();
    const latestResult = state.latestPoseResults[cubeIndex] ?? null;
    const cubeConfig = configSet?.cubes[cubeIndex] ?? null;
    const detectedCount = state.perCubeDetectedMarkerCounts[cubeIndex] ?? 0;

    let poseMode = "—";
    let reprojectionErrorPx: number | null = null;
    let poseFailureReason: string | null = null;

    if (latestResult !== null) {
      if (latestResult.success) {
        poseMode = latestResult.poseMode;
        reprojectionErrorPx = latestResult.finalMeanReprojectionErrorPx;
      } else {
        poseMode = "failed";
        poseFailureReason = `${latestResult.stage}:${latestResult.reason}`;
      }
    } else if (detectedCount === 0) {
      poseMode = "noMarkers";
    }

    return {
      cubeIndex,
      configLabel: cubeConfig?.configLabel ?? "(not loaded)",
      tagIds: cubeConfig?.tagIds ?? [],
      trackerState: snapshot.trackerState,
      coastFrameCount: snapshot.coastFrameCount,
      detectedMarkerCount: detectedCount,
      poseMode,
      reprojectionErrorPx,
      poseFailureReason,
    };
  });
}

async function runMultiCubeTrackingFrame(
  domElements: MultiCubeAppDomElements,
  state: MultiCubeAppRuntimeState,
): Promise<void> {
  if (
    state.detector === null ||
    state.scaledCameraIntrinsics === null ||
    state.multiCubeConfigSet === null
  ) {
    return;
  }

  const frameCapture = captureVideoFrameToGrayscale(
    domElements.videoElement,
    domElements.captureCanvas,
  );

  if (frameCapture === null) {
    return;
  }

  const configSet = state.multiCubeConfigSet;

  try {
    state.detectedMarkers = await detectAprilCubeMarkers(
      state.detector,
      frameCapture.grayscaleBuffer,
      frameCapture.captureWidth,
      frameCapture.captureHeight,
      configSet.unionTagIdSet,
    );
  } catch (error) {
    state.lifecycleState = "failed";
    updateMultiCubeAppUi(
      domElements,
      state,
      "cameraReady",
      "resolutionReady",
      error instanceof Error ? error.message : "detect failed",
      "blocked",
    );
    cancelMultiCubeTrackingLoop(state);
    return;
  }

  const partitions = partitionDetectedMarkersByCubeIndex(
    state.detectedMarkers,
    configSet.idToCubeIndex,
    MULTI_CUBE_CONFIG_COUNT,
  );

  const trackedPoses: (Pose | null)[] = new Array(MULTI_CUBE_CONFIG_COUNT).fill(null);
  const latestResults: (EstimateAprilCubeResult | null)[] = new Array(MULTI_CUBE_CONFIG_COUNT).fill(null);
  const detectedCounts: number[] = new Array(MULTI_CUBE_CONFIG_COUNT).fill(0);

  for (let cubeIndex = 0; cubeIndex < MULTI_CUBE_CONFIG_COUNT; cubeIndex += 1) {
    const cubeMarkers = partitions[cubeIndex] ?? [];
    detectedCounts[cubeIndex] = cubeMarkers.length;

    const { trackedPose, latestResult } = processOneCube(cubeIndex, cubeMarkers, state);
    trackedPoses[cubeIndex] = trackedPose;
    latestResults[cubeIndex] = latestResult;
  }

  state.trackedPoses = trackedPoses;
  state.latestPoseResults = latestResults;
  state.perCubeDetectedMarkerCounts = detectedCounts;
  state.perCubeStatuses = buildPerCubeStatusesFromState(state);

  drawMultiCubeOverlay({
    overlayCanvas: domElements.overlayCanvas,
    captureCanvas: domElements.captureCanvas,
    detectedMarkers: state.detectedMarkers,
    cubePoses: state.trackedPoses,
    boxDimensionsMeters: state.multiCubeConfigSet.cubes[0]!.boxDimensionsMeters,
    cameraIntrinsics: state.scaledCameraIntrinsics,
    distortionCoefficients: state.distortionCoefficients,
    overlayDisplayMode: state.overlayDisplayMode,
  });

  renderMultiCubeThreeOverlayFrame(domElements, state);

  const trackingCubeCount = state.perCubeStatuses.filter(
    (status) => status.trackerState === "tracking",
  ).length;
  const poseMessage = `${trackingCubeCount}/${MULTI_CUBE_CONFIG_COUNT} tracking`;

  updateMultiCubeAppUi(
    domElements,
    state,
    domElements.cameraStatusElement.textContent ?? "cameraReady",
    "resolutionReady",
    "detectorReady",
    poseMessage,
  );
}

/** Renders the 3D overlay frame, starting the model load if needed. */
export function renderMultiCubeThreeOverlayFrame(
  domElements: MultiCubeAppDomElements,
  state: MultiCubeAppRuntimeState,
): void {
  if (state.scaledCameraIntrinsics === null || state.multiCubeConfigSet === null) {
    return;
  }

  const cubeSizeMeters = state.multiCubeConfigSet.cubes[0]!.boxDimensionsMeters[0]!;
  const renderInput = {
    overlayDisplayMode: state.overlayDisplayMode,
    cubePoses: state.trackedPoses,
    cameraIntrinsics: state.scaledCameraIntrinsics,
    captureCanvas: domElements.captureCanvas,
    cubeSizeMeters,
  };

  if (state.threeOverlaySession !== null) {
    renderMultiCubeThreeOverlay(
      state.threeOverlaySession,
      domElements.threeModelCanvas,
      renderInput,
    );
    return;
  }

  // Start loading 3D models on first frame that requires them.
  if (state.threeOverlayLoadPromise === null && state.threeOverlayLoadError === null) {
    state.threeOverlayLoadPromise = createMultiCubeThreeOverlay(
      domElements.threeModelCanvas,
      cubeSizeMeters,
    )
      .then((session: MultiCubeThreeOverlaySession) => {
        state.threeOverlaySession = session;
        state.threeOverlayLoadPromise = null;
        state.threeOverlayLoadError = null;
        return session;
      })
      .catch((error: unknown) => {
        state.threeOverlayLoadPromise = null;
        state.threeOverlayLoadError =
          error instanceof Error ? error.message : "3D model load failed";
        return null;
      });
  }
}

/** Disposes the 3D overlay session and releases GPU resources. */
export function disposeMultiCubeThreeOverlaySession(
  state: MultiCubeAppRuntimeState,
): void {
  if (state.threeOverlaySession !== null) {
    disposeMultiCubeThreeOverlay(state.threeOverlaySession);
    state.threeOverlaySession = null;
  }
  state.threeOverlayLoadPromise = null;
  state.threeOverlayLoadError = null;
}

/** Starts the requestAnimationFrame multi-cube tracking loop. */
export function startMultiCubeTrackingLoop(
  domElements: MultiCubeAppDomElements,
  state: MultiCubeAppRuntimeState,
): void {
  cancelMultiCubeTrackingLoop(state);

  const tick = (): void => {
    if (state.isProcessingTrackingFrame) {
      state.animationFrameIdentifier = requestAnimationFrame(tick);
      return;
    }

    state.isProcessingTrackingFrame = true;

    void runMultiCubeTrackingFrame(domElements, state).finally(() => {
      state.isProcessingTrackingFrame = false;
      state.animationFrameIdentifier = requestAnimationFrame(tick);
    });
  };

  state.animationFrameIdentifier = requestAnimationFrame(tick);
}

/** Stops the multi-cube tracking loop and cancels any pending animation frame. */
export function stopMultiCubeTrackingLoop(state: MultiCubeAppRuntimeState): void {
  cancelMultiCubeTrackingLoop(state);
}
