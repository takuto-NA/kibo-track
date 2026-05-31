/**
 * Unit tests for calibration JSON parsing and persistence helpers.
 */
import { describe, expect, it } from "vitest";
import {
  parseCalibrationJson,
  restoreCalibrationFromStorage,
  serializeCalibrationForStorage,
} from "./parse-calibration-json.js";
import {
  CALIBRATION_LOCAL_STORAGE_KEY,
  clearPersistedCalibration,
  persistCalibrationJson,
  resolveReferenceCameraIntrinsics,
} from "./resolve-reference-intrinsics.js";

const VALID_CALIBRATION_JSON = JSON.stringify({
  camera_matrix: [
    [700, 0, 640],
    [0, 700, 360],
    [0, 0, 1],
  ],
  dist_coeffs: [-0.12, 0.03, 0, 0, 0],
  img_size: [1280, 720],
});

describe("parseCalibrationJson", () => {
  it("parses valid AprilCube-style calibration JSON", () => {
    const result = parseCalibrationJson(VALID_CALIBRATION_JSON);

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.referenceCameraIntrinsics.isPlaceholder).toBe(false);
    expect(result.referenceCameraIntrinsics.referenceWidth).toBe(1280);
    expect(result.referenceCameraIntrinsics.referenceHeight).toBe(720);
    expect(result.referenceCameraIntrinsics.intrinsics.focalLengthX).toBe(700);
    expect(result.distortionCoefficients).toEqual([-0.12, 0.03, 0, 0, 0]);
  });

  it("rejects malformed JSON", () => {
    const result = parseCalibrationJson("{not-json");

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.reason).toBe("invalidJson");
  });

  it("rejects non-positive focal lengths", () => {
    const result = parseCalibrationJson(
      JSON.stringify({
        camera_matrix: [
          [0, 0, 320],
          [0, 700, 180],
          [0, 0, 1],
        ],
        img_size: [640, 360],
      }),
    );

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.reason).toBe("nonPositiveFocalLength");
  });
});

describe("resolveReferenceCameraIntrinsics", () => {
  it("restores calibrated intrinsics from localStorage", () => {
    const storage = new Map<string, string>();
    const localStorageMock = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    };

    persistCalibrationJson(VALID_CALIBRATION_JSON, localStorageMock);
    const resolved = resolveReferenceCameraIntrinsics(localStorageMock);

    expect(resolved.intrinsicsSource).toBe("calibrated");
    expect(resolved.referenceCameraIntrinsics.intrinsics.focalLengthX).toBe(700);
    expect(storage.get(CALIBRATION_LOCAL_STORAGE_KEY)).toBe(VALID_CALIBRATION_JSON);
  });

  it("falls back to placeholder intrinsics when storage is empty", () => {
    const storage = new Map<string, string>();
    const localStorageMock = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    };

    clearPersistedCalibration(localStorageMock);
    const resolved = resolveReferenceCameraIntrinsics(localStorageMock);

    expect(resolved.intrinsicsSource).toBe("placeholder");
    expect(resolved.referenceCameraIntrinsics.isPlaceholder).toBe(true);
  });

  it("round-trips calibration through serialize and restore helpers", () => {
    const parseResult = parseCalibrationJson(VALID_CALIBRATION_JSON);

    if (!parseResult.success) {
      throw new Error("Expected valid calibration fixture.");
    }

    const serialized = serializeCalibrationForStorage(
      parseResult.referenceCameraIntrinsics,
      parseResult.distortionCoefficients,
    );
    const restored = restoreCalibrationFromStorage(serialized);

    expect(restored?.referenceCameraIntrinsics.intrinsics.focalLengthX).toBe(700);
    expect(restored?.distortionCoefficients).toEqual([-0.12, 0.03, 0, 0, 0]);
  });
});
