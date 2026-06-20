/**
 * Unit tests for multi-cube tracking loop per-cube status aggregation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PoseTracker } from "./pose-tracker.js";
import { MULTI_CUBE_CONFIG_COUNT } from "./constants.js";
import {
  buildInitialPerCubeStatuses,
  createInitialMultiCubeAppRuntimeState,
  resetMultiCubeTrackingState,
  type MultiCubeAppRuntimeState,
} from "./multi-cube-runtime.js";
import { buildPerCubeStatusesFromState } from "./multi-cube-tracking-loop.js";
import type { EstimateAprilCubePoseResult, Pose } from "kibo-track";

const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

beforeEach(() => {
  localStorageMock.getItem.mockClear();
  localStorageMock.getItem.mockReturnValue(null);
  vi.stubGlobal("localStorage", localStorageMock);
});

function buildInitialStateWithTrackers(): MultiCubeAppRuntimeState {
  return createInitialMultiCubeAppRuntimeState();
}

describe("buildInitialPerCubeStatuses", () => {
  it("returns 16 lost rows with empty config labels", () => {
    const statuses = buildInitialPerCubeStatuses();

    expect(statuses).toHaveLength(MULTI_CUBE_CONFIG_COUNT);

    for (const status of statuses) {
      expect(status.trackerState).toBe("lost");
      expect(status.configLabel).toBe("(not loaded)");
      expect(status.tagIds).toEqual([]);
      expect(status.detectedMarkerCount).toBe(0);
      expect(status.reprojectionErrorPx).toBeNull();
      expect(status.poseFailureReason).toBeNull();
      expect(status.poseMode).toBe("—");
    }
  });
});

describe("resetMultiCubeTrackingState", () => {
  it("resets every pose tracker and clears tracked poses", () => {
    const state = buildInitialStateWithTrackers();

    // Simulate one tracker entering tracking state.
    const samplePose: Pose = {
      rotation: [0, 0, 0, 1],
      translation: [0, 0, 0.25],
    };
    state.poseTrackers[0]!.updateFromMeasurement({
      pose: samplePose,
      finalMeanReprojectionErrorPx: 0.5,
      detectedMarkerCount: 3,
      poseMode: "multiFace",
      visibleFaceCount: 3,
    });

    resetMultiCubeTrackingState(state);

    for (const tracker of state.poseTrackers) {
      expect(tracker.getSnapshot().trackerState).toBe("lost");
    }

    for (const pose of state.trackedPoses) {
      expect(pose).toBeNull();
    }

    for (const result of state.latestPoseResults) {
      expect(result).toBeNull();
    }
  });
});

describe("buildPerCubeStatusesFromState", () => {
  it("reports noMarkers for cubes without detections or pose results", () => {
    const state = buildInitialStateWithTrackers();

    state.perCubeDetectedMarkerCounts = new Array(MULTI_CUBE_CONFIG_COUNT).fill(0);
    state.perCubeStatuses = buildInitialPerCubeStatuses();

    const statuses = buildPerCubeStatusesFromState(state);

    expect(statuses).toHaveLength(MULTI_CUBE_CONFIG_COUNT);

    for (const status of statuses) {
      expect(status.poseMode).toBe("noMarkers");
      expect(status.trackerState).toBe("lost");
      expect(status.detectedMarkerCount).toBe(0);
    }
  });

  it("marks a successful cube as tracking with reprojection error", () => {
    const state = buildInitialStateWithTrackers();
    state.multiCubeConfigSet = {
      cubeCount: MULTI_CUBE_CONFIG_COUNT,
      cubes: Array.from({ length: MULTI_CUBE_CONFIG_COUNT }, (_, i) => ({
        configLabel: `cube-${i}`,
        aprilCubeConfig: {} as never,
        dictionaryName: "4x4_100",
        kiboTagFamilyName: "DICT_4X4_100",
        tagIds: [i * 6, i * 6 + 1, i * 6 + 2, i * 6 + 3, i * 6 + 4, i * 6 + 5],
        configuredTagIdSet: new Set(),
        boxDimensionsMeters: [0.032, 0.032, 0.032] as const,
      })),
      idToCubeIndex: new Map(),
      unionTagIdSet: new Set(),
      kiboTagFamilyName: "DICT_4X4_100",
    };

    state.poseTrackers[3]!.updateFromMeasurement({
      pose: { rotation: [0, 0, 0, 1], translation: [0, 0, 0.2] },
      finalMeanReprojectionErrorPx: 0.42,
      detectedMarkerCount: 4,
      poseMode: "multiFace",
      visibleFaceCount: 3,
    });

    const counts = new Array(MULTI_CUBE_CONFIG_COUNT).fill(0);
    counts[3] = 4;
    state.perCubeDetectedMarkerCounts = counts;

    const results = new Array(MULTI_CUBE_CONFIG_COUNT).fill(null);
    results[3] = {
      success: true,
      pose: { rotation: [0, 0, 0, 1], translation: [0, 0, 0.2] },
      finalMeanReprojectionErrorPx: 0.42,
      detectedMarkerIds: [18, 19, 20, 21],
      correspondenceCount: 16,
      numInliers: 16,
      confidence: 0.9,
      poseMode: "multiFace",
      visibleFaceCount: 3,
      rejectedMarkerIds: [],
    } as unknown as EstimateAprilCubePoseResult;
    state.latestPoseResults = results;

    const statuses = buildPerCubeStatusesFromState(state);

    const cubeThree = statuses[3]!;
    expect(cubeThree.trackerState).toBe("tracking");
    expect(cubeThree.poseMode).toBe("multiFace");
    expect(cubeThree.reprojectionErrorPx).toBeCloseTo(0.42);
    expect(cubeThree.detectedMarkerCount).toBe(4);
    expect(cubeThree.configLabel).toBe("cube-3");
    expect(cubeThree.tagIds).toEqual([18, 19, 20, 21, 22, 23]);
  });

  it("marks a failed cube with poseFailureReason", () => {
    const state = buildInitialStateWithTrackers();

    const counts = new Array(MULTI_CUBE_CONFIG_COUNT).fill(0);
    counts[7] = 2;
    state.perCubeDetectedMarkerCounts = counts;

    const results = new Array(MULTI_CUBE_CONFIG_COUNT).fill(null);
    results[7] = {
      success: false,
      stage: "estimate",
      reason: "degenerateConfiguration",
    } as unknown as EstimateAprilCubePoseResult;
    state.latestPoseResults = results;

    const statuses = buildPerCubeStatusesFromState(state);
    const cubeSeven = statuses[7]!;

    expect(cubeSeven.poseMode).toBe("failed");
    expect(cubeSeven.poseFailureReason).toBe("estimate:degenerateConfiguration");
    expect(cubeSeven.detectedMarkerCount).toBe(2);
  });
});
