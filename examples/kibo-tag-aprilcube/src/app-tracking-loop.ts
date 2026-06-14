/**
 * Camera-frame tracking loop: detect markers, estimate pose, draw overlay.
 */
import { estimateAprilCubePose, type Pose } from "kibo-track";
import { captureVideoFrameToGrayscale } from "./camera.js";
import { undistortDetectedMarkers } from "./camera-distortion.js";
import { detectAprilCubeMarkers } from "./kibo-tag-detector.js";
import type { AppDomElements, AppRuntimeState } from "./app-runtime.js";
import { updateAppUi } from "./app-ui-text.js";
import { renderOverlayFrames } from "./app-overlay-session.js";

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

  const loadedConfig = state.loadedAprilCubeModelConfig;

  try {
    state.detectedMarkers = await detectAprilCubeMarkers(
      state.detector,
      frameCapture.grayscaleBuffer,
      frameCapture.captureWidth,
      frameCapture.captureHeight,
      loadedConfig.configuredTagIdSet,
    );
  } catch (error) {
    state.lifecycleState = "failed";
    updateAppUi(
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

  const aprilCubeConfig = loadedConfig.aprilCubeConfig;

  if (state.detectedMarkers.length === 0) {
    const missedFrameUpdate = state.poseTracker.updateFromMissedFrame();
    state.trackedPose = missedFrameUpdate.trackedPose;
    state.latestPoseResult = null;

    renderOverlayFrames(
      domElements,
      state,
      [],
      missedFrameUpdate.trackedPose,
    );

    updateAppUi(
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
      poseMode: state.latestPoseResult.poseMode,
      visibleFaceCount: state.latestPoseResult.visibleFaceCount,
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

  renderOverlayFrames(
    domElements,
    state,
    state.detectedMarkers,
    overlayPose,
  );

  updateAppUi(
    domElements,
    state,
    domElements.cameraStatusElement.textContent ?? "cameraReady",
    "resolutionReady",
    "detectorReady",
    poseMessage,
  );
}

/** Starts the requestAnimationFrame tracking loop. */
export function startTrackingLoop(domElements: AppDomElements, state: AppRuntimeState): void {
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

/** Stops the tracking loop and cancels any pending animation frame. */
export function stopAppTrackingLoop(state: AppRuntimeState): void {
  stopTrackingLoop(state);
}
