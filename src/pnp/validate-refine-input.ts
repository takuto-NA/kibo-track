/**
 * Input validation for refinePoseLM boundary checks.
 */
import { assertValidCameraIntrinsics } from "../core/validate-camera-intrinsics.js";
import { projectPoints } from "../core/project-points.js";
import type {
  ImagePoint2D,
  ObjectPoint3D,
  Pose,
  PoseEstimationFailureReason,
  CameraIntrinsics,
} from "../core/types.js";
import { MINIMUM_REFINEMENT_CORRESPONDENCE_COUNT } from "./constants.js";
import type { RefinePoseLMInput } from "./types.js";

function assertFiniteNumber(value: number, fieldName: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${fieldName} must be a finite number.`);
  }
}

function validatePointArray(
  imagePoints: ReadonlyArray<ImagePoint2D>,
  objectPoints: ReadonlyArray<ObjectPoint3D>,
): void {
  for (const [coordinateU, coordinateV] of imagePoints) {
    assertFiniteNumber(coordinateU, "image point u");
    assertFiniteNumber(coordinateV, "image point v");
  }

  for (const [objectX, objectY, objectZ] of objectPoints) {
    assertFiniteNumber(objectX, "object point x");
    assertFiniteNumber(objectY, "object point y");
    assertFiniteNumber(objectZ, "object point z");
  }
}

function validateInitialPoseProjectsAllPoints(
  objectPoints: ReadonlyArray<ObjectPoint3D>,
  initialPose: Pose,
  cameraIntrinsics: CameraIntrinsics,
): void {
  projectPoints(objectPoints, initialPose, cameraIntrinsics);
}

function validatePoseComponents(initialPose: Pose): void {
  assertFiniteNumber(initialPose.translation[0], "initial translation x");
  assertFiniteNumber(initialPose.translation[1], "initial translation y");
  assertFiniteNumber(initialPose.translation[2], "initial translation z");
  assertFiniteNumber(initialPose.rotation[0], "initial rotation x");
  assertFiniteNumber(initialPose.rotation[1], "initial rotation y");
  assertFiniteNumber(initialPose.rotation[2], "initial rotation z");
  assertFiniteNumber(initialPose.rotation[3], "initial rotation w");
}

/** Validates refinePoseLM input and returns a failure reason when invalid. */
export function validateRefinePoseLMInput(
  input: RefinePoseLMInput,
): PoseEstimationFailureReason | null {
  const { imagePoints, objectPoints, cameraIntrinsics, initialPose } = input;

  if (imagePoints.length !== objectPoints.length) {
    return "invalidInput";
  }

  if (objectPoints.length < MINIMUM_REFINEMENT_CORRESPONDENCE_COUNT) {
    return "notEnoughPoints";
  }

  try {
    assertValidCameraIntrinsics(cameraIntrinsics);
    validatePointArray(imagePoints, objectPoints);
    validatePoseComponents(initialPose);
    validateInitialPoseProjectsAllPoints(
      objectPoints,
      initialPose,
      cameraIntrinsics,
    );
  } catch {
    return "invalidInput";
  }

  return null;
}
