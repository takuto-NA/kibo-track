/**
 * Unit tests for lightweight pose tracker behavior.
 */
import { describe, expect, it } from "vitest";
import { PoseTracker } from "./pose-tracker.js";

const SAMPLE_POSE = {
  rotation: [0, 0, 0, 1] as const,
  translation: [0.01, -0.02, 0.2] as const,
};

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
