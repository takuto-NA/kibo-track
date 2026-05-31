/**
 * Unit tests for lightweight pose tracker behavior and rotation smoothing continuity.
 */
import {
  computeQuaternionGeodesicAngleRadians,
  rotationVectorToQuaternion,
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

const DEGREES_TO_RADIANS = Math.PI / 180;

const PREVIOUS_FRAME_QUATERNION: Quaternion = [0.1, 0.2, 0.3, 0.9];

const OPPOSITE_SIGN_EQUIVALENT_QUATERNION: Quaternion = [-0.1, -0.2, -0.3, -0.9];

const USER_REPORTED_GOOD_SINGLE_FACE_POSE: Pose = {
  rotation: rotationVectorToQuaternion([
    15.41 * DEGREES_TO_RADIANS,
    5.48 * DEGREES_TO_RADIANS,
    -50.82 * DEGREES_TO_RADIANS,
  ]),
  translation: [0.0632, 0.02561, 0.26298],
};

const USER_REPORTED_WARPED_SINGLE_FACE_POSE: Pose = {
  rotation: rotationVectorToQuaternion([
    -61.19 * DEGREES_TO_RADIANS,
    29.88 * DEGREES_TO_RADIANS,
    -45.72 * DEGREES_TO_RADIANS,
  ]),
  translation: [0.09799, 0.04888, 0.26058],
};

const USER_REPORTED_HIGH_ERROR_SINGLE_FACE_POSE: Pose = {
  rotation: rotationVectorToQuaternion([
    -28.95 * DEGREES_TO_RADIANS,
    -8.9 * DEGREES_TO_RADIANS,
    54.87 * DEGREES_TO_RADIANS,
  ]),
  translation: [0.01666, -0.01319, 0.18155],
};

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

describe("PoseTracker single-face planar quality gate", () => {
  it("rejects a very high-error single-face planar measurement without previous-frame context", () => {
    const tracker = new PoseTracker();

    const updateResult = tracker.updateFromMeasurement({
      pose: USER_REPORTED_HIGH_ERROR_SINGLE_FACE_POSE,
      finalMeanReprojectionErrorPx: 2.81,
      detectedMarkerCount: 1,
      poseMode: "singleFacePlanar",
      visibleFaceCount: 1,
    });

    expect(updateResult.trackerState).toBe("lost");
    expect(updateResult.trackedPose).toBeNull();
  });

  it("coasts instead of accepting a high-error single-face planar rotation jump", () => {
    const tracker = new PoseTracker();
    seedTrackerWithPose(tracker, USER_REPORTED_GOOD_SINGLE_FACE_POSE);

    const updateResult = tracker.updateFromMeasurement({
      pose: USER_REPORTED_WARPED_SINGLE_FACE_POSE,
      finalMeanReprojectionErrorPx: 1.33,
      detectedMarkerCount: 1,
      poseMode: "singleFacePlanar",
      visibleFaceCount: 1,
    });

    expect(updateResult.trackerState).toBe("coasting");
    expect(updateResult.trackedPose).toEqual(USER_REPORTED_GOOD_SINGLE_FACE_POSE);
  });

  it("accepts a high-error single-face planar measurement when no pose is tracked yet", () => {
    const tracker = new PoseTracker();

    const updateResult = tracker.updateFromMeasurement({
      pose: USER_REPORTED_WARPED_SINGLE_FACE_POSE,
      finalMeanReprojectionErrorPx: 1.31,
      detectedMarkerCount: 1,
      poseMode: "singleFacePlanar",
      visibleFaceCount: 1,
    });

    expect(updateResult.trackerState).toBe("tracking");
    expect(updateResult.trackedPose).toEqual(USER_REPORTED_WARPED_SINGLE_FACE_POSE);
  });

  it("accepts a high-error single-face planar measurement without a rotation jump", () => {
    const tracker = new PoseTracker();
    seedTrackerWithPose(tracker, USER_REPORTED_WARPED_SINGLE_FACE_POSE);

    const updateResult = tracker.updateFromMeasurement({
      pose: USER_REPORTED_WARPED_SINGLE_FACE_POSE,
      finalMeanReprojectionErrorPx: 1.31,
      detectedMarkerCount: 1,
      poseMode: "singleFacePlanar",
      visibleFaceCount: 1,
    });

    expect(updateResult.trackerState).toBe("tracking");
    expect(updateResult.trackedPose).not.toBeNull();
  });

  it("accepts a low-error single-face planar measurement", () => {
    const tracker = new PoseTracker();
    seedTrackerWithPose(tracker, USER_REPORTED_WARPED_SINGLE_FACE_POSE);

    const updateResult = tracker.updateFromMeasurement({
      pose: USER_REPORTED_GOOD_SINGLE_FACE_POSE,
      finalMeanReprojectionErrorPx: 0.02,
      detectedMarkerCount: 1,
      poseMode: "singleFacePlanar",
      visibleFaceCount: 1,
    });

    expect(updateResult.trackerState).toBe("tracking");
    expect(updateResult.trackedPose).not.toEqual(USER_REPORTED_WARPED_SINGLE_FACE_POSE);
  });
});
