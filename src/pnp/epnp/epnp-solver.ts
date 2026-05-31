/**
 * EPnP initial pose solver orchestrating control points, null space, and beta selection.
 */
import type { CameraIntrinsics, ImagePoint2D, ObjectPoint3D, Pose } from "../../core/types.js";
import { MINIMUM_CAMERA_SPACE_DEPTH } from "../constants.js";
import { computeBarycentricCoordinates } from "./barycentric-coordinates.js";
import { buildRhoVector, computeL6x10, findBetaCandidates } from "./beta-solver.js";
import {
  chooseControlPoints,
  computeControlPointPairDistances,
} from "./control-points.js";
import {
  buildMeasurementMatrix,
  computeNullSpaceBasis,
  type EpnpCameraParameters,
} from "./measurement-matrix.js";
import {
  epnpRecoveredPoseToPose,
  hasPositiveCameraSpaceDepth,
  recoverPoseFromBetas,
} from "./pose-recovery.js";

export interface EpnpSolveInput {
  readonly objectPoints: ReadonlyArray<ObjectPoint3D>;
  readonly imagePoints: ReadonlyArray<ImagePoint2D>;
  readonly cameraIntrinsics: CameraIntrinsics;
}

export interface EpnpSolveResult {
  readonly pose: Pose;
  readonly meanReprojectionErrorPx: number;
}

function buildEpnpCameraParameters(
  cameraIntrinsics: CameraIntrinsics,
): EpnpCameraParameters {
  return {
    focalLengthX: cameraIntrinsics.focalLengthX,
    focalLengthY: cameraIntrinsics.focalLengthY,
    principalPointX: cameraIntrinsics.principalPointX,
    principalPointY: cameraIntrinsics.principalPointY,
  };
}

/** Solves initial cameraFromObject pose from 2D-3D correspondences using EPnP. */
export function solveEpnpInitialPose(input: EpnpSolveInput): EpnpSolveResult {
  if (input.objectPoints.length !== input.imagePoints.length) {
    throw new RangeError("Object points and image points must have the same length.");
  }

  const controlPoints = chooseControlPoints(input.objectPoints);
  const barycentricCoordinates = computeBarycentricCoordinates(
    input.objectPoints,
    controlPoints,
  );
  const cameraParameters = buildEpnpCameraParameters(input.cameraIntrinsics);
  const measurementMatrix = buildMeasurementMatrix(
    input.imagePoints,
    barycentricCoordinates,
    cameraParameters,
  );
  const nullSpaceBasis = computeNullSpaceBasis(measurementMatrix);
  const lMatrix = computeL6x10(nullSpaceBasis);
  const rhoVector = buildRhoVector(computeControlPointPairDistances(controlPoints));
  const betaCandidates = findBetaCandidates(lMatrix, rhoVector);

  let bestRecoveredPose = recoverPoseFromBetas({
    objectPoints: input.objectPoints,
    imagePoints: input.imagePoints,
    barycentricCoordinates,
    nullSpaceBasis,
    betas: betaCandidates[0] ?? [0, 0, 0, 0],
    cameraParameters,
  });

  for (let candidateIndex = 1; candidateIndex < betaCandidates.length; candidateIndex += 1) {
    const betas = betaCandidates[candidateIndex];

    if (betas === undefined) {
      continue;
    }

    const recoveredPose = recoverPoseFromBetas({
      objectPoints: input.objectPoints,
      imagePoints: input.imagePoints,
      barycentricCoordinates,
      nullSpaceBasis,
      betas,
      cameraParameters,
    });

    if (recoveredPose.meanReprojectionErrorPx < bestRecoveredPose.meanReprojectionErrorPx) {
      bestRecoveredPose = recoveredPose;
    }
  }

  if (
    !hasPositiveCameraSpaceDepth(
      bestRecoveredPose.cameraPoints,
      MINIMUM_CAMERA_SPACE_DEPTH,
    )
  ) {
    throw new RangeError("EPnP recovered pose failed chirality check.");
  }

  return {
    pose: epnpRecoveredPoseToPose(bestRecoveredPose),
    meanReprojectionErrorPx: bestRecoveredPose.meanReprojectionErrorPx,
  };
}
