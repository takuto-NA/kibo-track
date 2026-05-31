/**
 * Unit tests for lightweight pose tracker behavior and rotation smoothing continuity.
 */
import {
  computeQuaternionGeodesicAngleRadians,
  type Pose,
  type Quaternion,
} from "kibo-track";
import { describe, expect, it } from "vitest";
import { PoseTracker } from "./pose-tracker.js";
import {
  USER_REPORTED_FRAME_A_POSE,
  USER_REPORTED_FRAME_B_POSE,
} from "./test-fixtures/user-reported-pose-frames.js";

const RADIANS_TO_DEGREES = 180 / Math.PI;

/** Maximum rotation step (deg) allowed after one smoothing update at alpha=0.35. */
const MAXIMUM_ACCEPTABLE_SMOOTHING_STEP_DEGREES = 15;

/** Maximum rotation step (deg) when measurement is the same rotation with flipped quaternion sign. */
const MAXIMUM_SAME_ROTATION_SMOOTHING_STEP_DEGREES = 1;

const SAMPLE_POSE: Pose = {
  rotation: [0, 0, 0, 1],
  translation: [0.01, -0.02, 0.2],
};

const PREVIOUS_FRAME_QUATERNION: Quaternion = [0.1, 0.2, 0.3, 0.9];

const OPPOSITE_SIGN_EQUIVALENT_QUATERNION: Quaternion = [-0.1, -0.2, -0.3, -0.9];

function computeQuaternionGeodesicDegrees(
  leftRotation: Quaternion,
  rightRotation: Quaternion,
): number {
  return computeQuaternionGeodesicAngleRadians(leftRotation, rightRotation) * RADIANS_TO_DEGREES;
}

function seedTrackerWithPose(tracker: PoseTracker, pose: Pose): void {
  tracker.updateFromMeasurement({
    pose,
    finalMeanReprojectionErrorPx: 0.5,
    detectedMarkerCount: 2,
  });
}

describe("PoseTracker", () => {
  it("starts in lost state without a tracked pose", () => {
    const tracker = new PoseTracker();
    const snapshot = tracker.getSnapshot();

    expect(snapshot.trackerState).toBe("lost");
    expect(snapshot.hasTrackedPose).toBe(false);
  });

  it("enters tracking after a valid measurement", () => {
    const tracker = new PoseTracker();
    const updateResult = tracker.updateFromMeasurement({
      pose: SAMPLE_POSE,
      finalMeanReprojectionErrorPx: 0.5,
      detectedMarkerCount: 2,
    });

    expect(updateResult.trackerState).toBe("tracking");
    expect(updateResult.trackedPose).not.toBeNull();
    expect(updateResult.previousPoseForEstimation).not.toBeNull();
  });

  it("coasts briefly when frames are missed", () => {
    const tracker = new PoseTracker();
    tracker.updateFromMeasurement({
      pose: SAMPLE_POSE,
      finalMeanReprojectionErrorPx: 0.5,
      detectedMarkerCount: 2,
    });

    const coastResult = tracker.updateFromMissedFrame();

    expect(coastResult.trackerState).toBe("coasting");
    expect(coastResult.trackedPose).not.toBeNull();
  });
});

describe("PoseTracker rotation smoothing", () => {
  it("keeps a small rotation step for near-180° user-reported consecutive frames", () => {
    const tracker = new PoseTracker();
    seedTrackerWithPose(tracker, USER_REPORTED_FRAME_A_POSE);

    const measurementToFrameB = tracker.updateFromMeasurement({
      pose: USER_REPORTED_FRAME_B_POSE,
      finalMeanReprojectionErrorPx: 0.51,
      detectedMarkerCount: 2,
    });

    expect(measurementToFrameB.trackedPose).not.toBeNull();

    const smoothingStepDegrees = computeQuaternionGeodesicDegrees(
      USER_REPORTED_FRAME_A_POSE.rotation,
      measurementToFrameB.trackedPose!.rotation,
    );
    const trueMeasurementDeltaDegrees = computeQuaternionGeodesicDegrees(
      USER_REPORTED_FRAME_A_POSE.rotation,
      USER_REPORTED_FRAME_B_POSE.rotation,
    );

    expect(trueMeasurementDeltaDegrees).toBeLessThan(MAXIMUM_ACCEPTABLE_SMOOTHING_STEP_DEGREES);
    expect(smoothingStepDegrees).toBeLessThan(MAXIMUM_ACCEPTABLE_SMOOTHING_STEP_DEGREES);
    expect(smoothingStepDegrees).toBeLessThanOrEqual(
      trueMeasurementDeltaDegrees + Number.EPSILON,
    );
  });

  it("does not rotate when measurement is the same rotation with opposite quaternion sign", () => {
    const tracker = new PoseTracker();
    const previousPose: Pose = {
      rotation: PREVIOUS_FRAME_QUATERNION,
      translation: [0, 0, 0.3],
    };
    const equivalentMeasurementPose: Pose = {
      rotation: OPPOSITE_SIGN_EQUIVALENT_QUATERNION,
      translation: [0, 0, 0.3],
    };

    seedTrackerWithPose(tracker, previousPose);

    const updateResult = tracker.updateFromMeasurement({
      pose: equivalentMeasurementPose,
      finalMeanReprojectionErrorPx: 0.45,
      detectedMarkerCount: 2,
    });

    expect(updateResult.trackedPose).not.toBeNull();

    const smoothingStepDegrees = computeQuaternionGeodesicDegrees(
      previousPose.rotation,
      updateResult.trackedPose!.rotation,
    );

    expect(smoothingStepDegrees).toBeLessThan(MAXIMUM_SAME_ROTATION_SMOOTHING_STEP_DEGREES);
  });
});
