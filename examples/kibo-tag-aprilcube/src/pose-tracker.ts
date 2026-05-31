/**
 * Lightweight pose tracker with previous-pose prior and translation lerp plus rotation slerp.
 */
import { computeQuaternionGeodesicAngleRadians, slerpQuaternion, type Pose } from "kibo-track";

/** Tracker lifecycle states for diagnostics. */
export type PoseTrackerState = "tracking" | "coasting" | "lost";

/** Maximum frames to coast without detections before transitioning to lost. */
export const POSE_TRACKER_MAX_COAST_FRAMES = 8;

/** Maximum reprojection error (px) before resetting tracked pose. */
export const POSE_TRACKER_MAX_REPROJECTION_ERROR_PX = 12;

/** Maximum reprojection error for accepting single-face planar measurements. */
export const SINGLE_FACE_PLANAR_MAX_REPROJECTION_ERROR_PX = 0.75;

/** Absolute single-face planar reprojection limit; above this the marker fit is not trustworthy. */
export const SINGLE_FACE_PLANAR_ABSOLUTE_MAX_REPROJECTION_ERROR_PX = 2;

/** Rotation jump threshold for suppressing likely single-face planar branch flips. */
export const SINGLE_FACE_PLANAR_MAX_ROTATION_JUMP_RADIANS = Math.PI / 4;

/** Exponential smoothing factor for accepted pose measurements. */
export const POSE_TRACKER_SMOOTHING_ALPHA = 0.35;

export interface PoseTrackerMeasurement {
  readonly pose: Pose;
  readonly finalMeanReprojectionErrorPx: number;
  readonly detectedMarkerCount: number;
  readonly poseMode?: "multiFace" | "singleFacePlanar" | "planarAmbiguous";
  readonly visibleFaceCount?: number;
}

export interface PoseTrackerUpdateResult {
  readonly trackerState: PoseTrackerState;
  readonly trackedPose: Pose | null;
  readonly previousPoseForEstimation: Pose | null;
  readonly coastFrameCount: number;
}

export interface PoseTrackerSnapshot {
  readonly trackerState: PoseTrackerState;
  readonly coastFrameCount: number;
  readonly hasTrackedPose: boolean;
}

function blendTranslation(
  previousTranslation: readonly [number, number, number],
  measurementTranslation: readonly [number, number, number],
  smoothingAlpha: number,
): readonly [number, number, number] {
  const retainWeight = 1 - smoothingAlpha;

  return [
    retainWeight * previousTranslation[0] + smoothingAlpha * measurementTranslation[0],
    retainWeight * previousTranslation[1] + smoothingAlpha * measurementTranslation[1],
    retainWeight * previousTranslation[2] + smoothingAlpha * measurementTranslation[2],
  ];
}

function smoothPose(previousPose: Pose, measurementPose: Pose): Pose {
  return {
    rotation: slerpQuaternion(
      previousPose.rotation,
      measurementPose.rotation,
      POSE_TRACKER_SMOOTHING_ALPHA,
    ),
    translation: blendTranslation(
      previousPose.translation,
      measurementPose.translation,
      POSE_TRACKER_SMOOTHING_ALPHA,
    ),
  };
}

function shouldRejectSingleFacePlanarMeasurement(
  previousPose: Pose | null,
  measurement: PoseTrackerMeasurement,
): boolean {
  if (measurement.poseMode !== "singleFacePlanar") {
    return false;
  }

  if (measurement.visibleFaceCount !== undefined && measurement.visibleFaceCount !== 1) {
    return false;
  }

  if (
    measurement.finalMeanReprojectionErrorPx >
    SINGLE_FACE_PLANAR_ABSOLUTE_MAX_REPROJECTION_ERROR_PX
  ) {
    return true;
  }

  if (measurement.finalMeanReprojectionErrorPx <= SINGLE_FACE_PLANAR_MAX_REPROJECTION_ERROR_PX) {
    return false;
  }

  if (previousPose === null) {
    return false;
  }

  const rotationJumpRadians = computeQuaternionGeodesicAngleRadians(
    previousPose.rotation,
    measurement.pose.rotation,
  );

  return rotationJumpRadians > SINGLE_FACE_PLANAR_MAX_ROTATION_JUMP_RADIANS;
}

/** Maintains temporal pose state for video-frame AprilCube estimation. */
export class PoseTracker {
  private trackedPose: Pose | null = null;
  private trackerState: PoseTrackerState = "lost";
  private coastFrameCount = 0;

  /** Resets tracker state after camera restart or large error spikes. */
  reset(): void {
    this.trackedPose = null;
    this.trackerState = "lost";
    this.coastFrameCount = 0;
  }

  /** Returns a snapshot for diagnostics rendering. */
  getSnapshot(): PoseTrackerSnapshot {
    return {
      trackerState: this.trackerState,
      coastFrameCount: this.coastFrameCount,
      hasTrackedPose: this.trackedPose !== null,
    };
  }

  /** Updates tracker from a successful pose measurement. */
  updateFromMeasurement(measurement: PoseTrackerMeasurement): PoseTrackerUpdateResult {
    if (shouldRejectSingleFacePlanarMeasurement(this.trackedPose, measurement)) {
      return this.updateFromMissedFrame();
    }

    if (measurement.finalMeanReprojectionErrorPx > POSE_TRACKER_MAX_REPROJECTION_ERROR_PX) {
      this.reset();
      return {
        trackerState: this.trackerState,
        trackedPose: null,
        previousPoseForEstimation: null,
        coastFrameCount: this.coastFrameCount,
      };
    }

    if (this.trackedPose === null) {
      this.trackedPose = measurement.pose;
    } else {
      this.trackedPose = smoothPose(this.trackedPose, measurement.pose);
    }

    this.trackerState = "tracking";
    this.coastFrameCount = 0;

    return {
      trackerState: this.trackerState,
      trackedPose: this.trackedPose,
      previousPoseForEstimation: this.trackedPose,
      coastFrameCount: this.coastFrameCount,
    };
  }

  /** Advances tracker when detections or pose estimation fail for one frame. */
  updateFromMissedFrame(): PoseTrackerUpdateResult {
    if (this.trackedPose === null) {
      this.trackerState = "lost";
      this.coastFrameCount = 0;

      return {
        trackerState: this.trackerState,
        trackedPose: null,
        previousPoseForEstimation: null,
        coastFrameCount: this.coastFrameCount,
      };
    }

    this.coastFrameCount += 1;

    if (this.coastFrameCount > POSE_TRACKER_MAX_COAST_FRAMES) {
      this.reset();
      return {
        trackerState: this.trackerState,
        trackedPose: null,
        previousPoseForEstimation: null,
        coastFrameCount: this.coastFrameCount,
      };
    }

    this.trackerState = "coasting";

    return {
      trackerState: this.trackerState,
      trackedPose: this.trackedPose,
      previousPoseForEstimation: this.trackedPose,
      coastFrameCount: this.coastFrameCount,
    };
  }
}
