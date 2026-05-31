/**
 * Validates estimatePose input and maps geometry failures to public reasons.
 */
import { assertValidCameraIntrinsics } from "../core/validate-camera-intrinsics.js";
import type { ImagePoint2D, ObjectPoint3D } from "../core/types.js";
import { checkGeometryDegeneracy } from "./geometry-degeneracy.js";
import type { EstimatePoseInput } from "./estimate-pose-types.js";

function hasFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function validatePointArrayLengthMatch(
  imagePoints: ReadonlyArray<ImagePoint2D>,
  objectPoints: ReadonlyArray<ObjectPoint3D>,
): boolean {
  return imagePoints.length === objectPoints.length;
}

function validateImagePoints(imagePoints: ReadonlyArray<ImagePoint2D>): boolean {
  for (const imagePoint of imagePoints) {
    if (!hasFiniteNumber(imagePoint[0]) || !hasFiniteNumber(imagePoint[1])) {
      return false;
    }
  }

  return true;
}

function validateObjectPoints(objectPoints: ReadonlyArray<ObjectPoint3D>): boolean {
  for (const objectPoint of objectPoints) {
    if (
      !hasFiniteNumber(objectPoint[0]) ||
      !hasFiniteNumber(objectPoint[1]) ||
      !hasFiniteNumber(objectPoint[2])
    ) {
      return false;
    }
  }

  return true;
}

/** Validates estimatePose input; returns a failure reason or null when valid. */
export function validateEstimatePoseInput(
  input: EstimatePoseInput,
): "invalidInput" | "notEnoughPoints" | "degenerateConfiguration" | null {
  if (!validatePointArrayLengthMatch(input.imagePoints, input.objectPoints)) {
    return "invalidInput";
  }

  if (!validateImagePoints(input.imagePoints) || !validateObjectPoints(input.objectPoints)) {
    return "invalidInput";
  }

  try {
    assertValidCameraIntrinsics(input.cameraIntrinsics);
  } catch {
    return "invalidInput";
  }

  const degeneracyCheck = checkGeometryDegeneracy(input.objectPoints);

  if (degeneracyCheck.isDegenerate) {
    return degeneracyCheck.reason ?? "degenerateConfiguration";
  }

  return null;
}
