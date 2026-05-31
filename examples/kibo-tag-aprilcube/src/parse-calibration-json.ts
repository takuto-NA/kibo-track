/**
 * Parses AprilCube/calibdb-style camera calibration JSON for the browser example.
 */
import type { CameraIntrinsics } from "kibo-track";
import type { ReferenceCameraIntrinsics } from "./types.js";

/** Supported calibration JSON shape (AprilCube / OpenCV export). */
export interface CalibrationJsonInput {
  readonly camera_matrix?: readonly (readonly number[])[];
  readonly dist_coeffs?: readonly number[];
  readonly img_size?: readonly [number, number];
}

/** Recoverable calibration parse failure reasons. */
export type CalibrationParseFailureReason =
  | "invalidJson"
  | "missingCameraMatrix"
  | "invalidCameraMatrixShape"
  | "nonPositiveFocalLength"
  | "invalidImageSize";

/** Successful calibration parse result. */
export interface CalibrationParseSuccess {
  readonly success: true;
  readonly referenceCameraIntrinsics: ReferenceCameraIntrinsics;
  readonly distortionCoefficients: readonly number[];
}

/** Failed calibration parse result. */
export interface CalibrationParseFailure {
  readonly success: false;
  readonly reason: CalibrationParseFailureReason;
  readonly detail: string;
}

/** Result of parseCalibrationJson. */
export type CalibrationParseResult = CalibrationParseSuccess | CalibrationParseFailure;

const CAMERA_MATRIX_ROW_COUNT = 3;
const CAMERA_MATRIX_COLUMN_COUNT = 3;
const MINIMUM_POSITIVE_FOCAL_LENGTH = Number.EPSILON;

function parseJsonObject(rawJsonText: string): CalibrationJsonInput | CalibrationParseFailure {
  try {
    const parsedValue: unknown = JSON.parse(rawJsonText);

    if (typeof parsedValue !== "object" || parsedValue === null) {
      return {
        success: false,
        reason: "invalidJson",
        detail: "Calibration JSON root must be an object.",
      };
    }

    return parsedValue as CalibrationJsonInput;
  } catch {
    return {
      success: false,
      reason: "invalidJson",
      detail: "Calibration text is not valid JSON.",
    };
  }
}

function readCameraMatrix(
  calibrationJson: CalibrationJsonInput,
): CameraIntrinsics | CalibrationParseFailure {
  const cameraMatrix = calibrationJson.camera_matrix;

  if (cameraMatrix === undefined) {
    return {
      success: false,
      reason: "missingCameraMatrix",
      detail: "Calibration JSON is missing camera_matrix.",
    };
  }

  if (cameraMatrix.length !== CAMERA_MATRIX_ROW_COUNT) {
    return {
      success: false,
      reason: "invalidCameraMatrixShape",
      detail: "camera_matrix must have exactly three rows.",
    };
  }

  for (const matrixRow of cameraMatrix) {
    if (matrixRow.length !== CAMERA_MATRIX_COLUMN_COUNT) {
      return {
        success: false,
        reason: "invalidCameraMatrixShape",
        detail: "camera_matrix must be 3x3.",
      };
    }
  }

  const focalLengthX = cameraMatrix[0]?.[0];
  const focalLengthY = cameraMatrix[1]?.[1];
  const principalPointX = cameraMatrix[0]?.[2];
  const principalPointY = cameraMatrix[1]?.[2];

  if (
    focalLengthX === undefined ||
    focalLengthY === undefined ||
    principalPointX === undefined ||
    principalPointY === undefined
  ) {
    return {
      success: false,
      reason: "invalidCameraMatrixShape",
      detail: "camera_matrix focal lengths and principal point are required.",
    };
  }

  if (focalLengthX <= MINIMUM_POSITIVE_FOCAL_LENGTH || focalLengthY <= MINIMUM_POSITIVE_FOCAL_LENGTH) {
    return {
      success: false,
      reason: "nonPositiveFocalLength",
      detail: "camera_matrix focal lengths must be positive.",
    };
  }

  return {
    focalLengthX,
    focalLengthY,
    principalPointX,
    principalPointY,
  };
}

function readImageSize(
  calibrationJson: CalibrationJsonInput,
): { width: number; height: number } | CalibrationParseFailure {
  const imageSize = calibrationJson.img_size;

  if (imageSize === undefined) {
    return {
      success: false,
      reason: "invalidImageSize",
      detail: "Calibration JSON is missing img_size [width, height].",
    };
  }

  const imageWidth = imageSize[0];
  const imageHeight = imageSize[1];

  if (
    imageWidth === undefined ||
    imageHeight === undefined ||
    imageWidth <= 0 ||
    imageHeight <= 0
  ) {
    return {
      success: false,
      reason: "invalidImageSize",
      detail: "img_size must be [positiveWidth, positiveHeight].",
    };
  }

  return {
    width: imageWidth,
    height: imageHeight,
  };
}

/** Parses calibration JSON into reference-resolution intrinsics. */
export function parseCalibrationJson(rawJsonText: string): CalibrationParseResult {
  const parsedJson = parseJsonObject(rawJsonText);

  if ("success" in parsedJson && parsedJson.success === false) {
    return parsedJson;
  }

  const calibrationJson = parsedJson as CalibrationJsonInput;
  const cameraIntrinsics = readCameraMatrix(calibrationJson);

  if ("success" in cameraIntrinsics && cameraIntrinsics.success === false) {
    return cameraIntrinsics;
  }

  const imageSize = readImageSize(calibrationJson);

  if ("success" in imageSize && imageSize.success === false) {
    return imageSize;
  }

  const intrinsics = cameraIntrinsics as CameraIntrinsics;
  const resolvedImageSize = imageSize as { width: number; height: number };

  return {
    success: true,
    referenceCameraIntrinsics: {
      referenceWidth: resolvedImageSize.width,
      referenceHeight: resolvedImageSize.height,
      isPlaceholder: false,
      intrinsics,
    },
    distortionCoefficients: calibrationJson.dist_coeffs ?? [],
  };
}

/** Serializes accepted calibration for localStorage persistence. */
export function serializeCalibrationForStorage(
  referenceCameraIntrinsics: ReferenceCameraIntrinsics,
  distortionCoefficients: readonly number[],
): string {
  return JSON.stringify({
    camera_matrix: [
      [referenceCameraIntrinsics.intrinsics.focalLengthX, 0, referenceCameraIntrinsics.intrinsics.principalPointX],
      [0, referenceCameraIntrinsics.intrinsics.focalLengthY, referenceCameraIntrinsics.intrinsics.principalPointY],
      [0, 0, 1],
    ],
    dist_coeffs: [...distortionCoefficients],
    img_size: [referenceCameraIntrinsics.referenceWidth, referenceCameraIntrinsics.referenceHeight],
  });
}

/** Restores calibration from localStorage text; returns null when missing or invalid. */
export function restoreCalibrationFromStorage(
  storedJsonText: string | null,
): CalibrationParseSuccess | null {
  if (storedJsonText === null || storedJsonText.trim().length === 0) {
    return null;
  }

  const parseResult = parseCalibrationJson(storedJsonText);

  if (!parseResult.success) {
    return null;
  }

  return parseResult;
}
