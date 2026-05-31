/**
 * Resolves reference camera intrinsics from calibrated storage or placeholder defaults.
 */
import { createPlaceholderReferenceCameraIntrinsics } from "./reference-intrinsics.js";
import { restoreCalibrationFromStorage } from "./parse-calibration-json.js";
import type { ReferenceCameraIntrinsics } from "./types.js";

/** localStorage key for persisted calibration JSON. */
export const CALIBRATION_LOCAL_STORAGE_KEY = "kibo-tag-aprilcube-calibration-json";

/** Source label for diagnostics. */
export type IntrinsicsSourceLabel = "placeholder" | "calibrated";

export interface ResolvedReferenceIntrinsics {
  readonly referenceCameraIntrinsics: ReferenceCameraIntrinsics;
  readonly intrinsicsSource: IntrinsicsSourceLabel;
  readonly distortionCoefficients: readonly number[];
}

/** Reads persisted calibration or falls back to placeholder intrinsics. */
export function resolveReferenceCameraIntrinsics(
  localStorageObject: Pick<Storage, "getItem"> = window.localStorage,
): ResolvedReferenceIntrinsics {
  const storedCalibration = restoreCalibrationFromStorage(
    localStorageObject.getItem(CALIBRATION_LOCAL_STORAGE_KEY),
  );

  if (storedCalibration !== null) {
    return {
      referenceCameraIntrinsics: storedCalibration.referenceCameraIntrinsics,
      intrinsicsSource: "calibrated",
      distortionCoefficients: storedCalibration.distortionCoefficients,
    };
  }

  return {
    referenceCameraIntrinsics: createPlaceholderReferenceCameraIntrinsics(),
    intrinsicsSource: "placeholder",
    distortionCoefficients: [],
  };
}

/** Persists accepted calibration JSON to localStorage. */
export function persistCalibrationJson(
  calibrationJsonText: string,
  localStorageObject: Pick<Storage, "setItem"> = window.localStorage,
): void {
  localStorageObject.setItem(CALIBRATION_LOCAL_STORAGE_KEY, calibrationJsonText);
}

/** Clears persisted calibration from localStorage. */
export function clearPersistedCalibration(
  localStorageObject: Pick<Storage, "removeItem"> = window.localStorage,
): void {
  localStorageObject.removeItem(CALIBRATION_LOCAL_STORAGE_KEY);
}
