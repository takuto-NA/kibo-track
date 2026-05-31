/**
 * Decomposes a planar homography into candidate camera-from-plane poses.
 */
import { rotationMatrixToQuaternion } from "../../core/quaternion.js";
import { transformObjectPointToCamera } from "../../core/pose-matrix.js";
import type { ObjectPoint3D, Pose } from "../../core/types.js";
import { MINIMUM_CAMERA_SPACE_DEPTH } from "../constants.js";
import { convertCameraFromPlanePoseToObjectPose } from "./plane-basis.js";
import type { CoplanarPlaneBasis, HomographyMatrix3x3 } from "./types.js";

const MINIMUM_ROTATION_COLUMN_NORM = 1e-9;

interface PlanePoseCandidateRaw {
  readonly rotationMatrix: readonly [number, number, number, number, number, number, number, number, number];
  readonly translation: readonly [number, number, number];
}

function extractHomographyColumn(
  homographyMatrix: HomographyMatrix3x3,
  columnIndex: number,
): readonly [number, number, number] {
  return [
    homographyMatrix[columnIndex] ?? 0,
    homographyMatrix[columnIndex + 3] ?? 0,
    homographyMatrix[columnIndex + 6] ?? 0,
  ];
}

function normalizeVector(
  vector: readonly [number, number, number],
): readonly [number, number, number] | null {
  const length = Math.hypot(vector[0], vector[1], vector[2]);

  if (length <= MINIMUM_ROTATION_COLUMN_NORM) {
    return null;
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function crossProduct(
  leftVector: readonly [number, number, number],
  rightVector: readonly [number, number, number],
): readonly [number, number, number] {
  return [
    leftVector[1] * rightVector[2] - leftVector[2] * rightVector[1],
    leftVector[2] * rightVector[0] - leftVector[0] * rightVector[2],
    leftVector[0] * rightVector[1] - leftVector[1] * rightVector[0],
  ];
}

function buildRotationMatrixFromColumns(
  firstColumn: readonly [number, number, number],
  secondColumn: readonly [number, number, number],
  thirdColumn: readonly [number, number, number],
): readonly [number, number, number, number, number, number, number, number, number] {
  return [
    firstColumn[0],
    secondColumn[0],
    thirdColumn[0],
    firstColumn[1],
    secondColumn[1],
    thirdColumn[1],
    firstColumn[2],
    secondColumn[2],
    thirdColumn[2],
  ];
}

function buildPlanePoseCandidateRaw(
  homographyMatrix: HomographyMatrix3x3,
  homographySign: number,
  flipSecondAxisSign: boolean,
): PlanePoseCandidateRaw | null {
  const firstHomographyColumn = extractHomographyColumn(homographyMatrix, 0);
  const secondHomographyColumn = extractHomographyColumn(homographyMatrix, 1);
  const translationColumn = extractHomographyColumn(homographyMatrix, 2);
  const firstColumnRaw = [
    homographySign * firstHomographyColumn[0],
    homographySign * firstHomographyColumn[1],
    homographySign * firstHomographyColumn[2],
  ] as const;
  const secondColumnRaw = [
    homographySign * secondHomographyColumn[0],
    homographySign * secondHomographyColumn[1],
    homographySign * secondHomographyColumn[2],
  ] as const;
  const translationRaw = [
    homographySign * translationColumn[0],
    homographySign * translationColumn[1],
    homographySign * translationColumn[2],
  ] as const;

  const firstColumn = normalizeVector(firstColumnRaw);

  if (firstColumn === null) {
    return null;
  }

  const scaledSecondColumn: readonly [number, number, number] = flipSecondAxisSign
    ? [-secondColumnRaw[0], -secondColumnRaw[1], -secondColumnRaw[2]]
    : secondColumnRaw;
  const secondColumn = normalizeVector(scaledSecondColumn);

  if (secondColumn === null) {
    return null;
  }

  const thirdColumn = crossProduct(firstColumn, secondColumn);
  const rotationMatrix = buildRotationMatrixFromColumns(firstColumn, secondColumn, thirdColumn);
  const scaleEstimate = Math.hypot(firstColumnRaw[0], firstColumnRaw[1], firstColumnRaw[2]);
  const translation: readonly [number, number, number] = [
    translationRaw[0] / scaleEstimate,
    translationRaw[1] / scaleEstimate,
    translationRaw[2] / scaleEstimate,
  ];

  return {
    rotationMatrix,
    translation,
  };
}

function hasPositiveDepthForObjectPoints(
  pose: Pose,
  objectPoints: ReadonlyArray<ObjectPoint3D>,
): boolean {
  for (const objectPoint of objectPoints) {
    const cameraPoint = transformObjectPointToCamera(objectPoint, pose);

    if (cameraPoint[2] <= MINIMUM_CAMERA_SPACE_DEPTH) {
      return false;
    }
  }

  return true;
}

function convertRawCandidateToObjectPose(
  rawCandidate: PlanePoseCandidateRaw,
  planeBasis: CoplanarPlaneBasis,
): Pose {
  const objectPoseComponents = convertCameraFromPlanePoseToObjectPose(
    rawCandidate.rotationMatrix,
    rawCandidate.translation,
    planeBasis,
  );

  return {
    rotation: rotationMatrixToQuaternion(objectPoseComponents.rotationMatrix),
    translation: objectPoseComponents.translation,
  };
}

/** Decomposes a homography into valid camera-from-object pose candidates. */
export function decomposeHomographyToPoseCandidates(
  homographyMatrix: HomographyMatrix3x3,
  planeBasis: CoplanarPlaneBasis,
  objectPoints: ReadonlyArray<ObjectPoint3D>,
): Pose[] {
  const poseCandidates: Pose[] = [];

  for (const homographySign of [1, -1]) {
    for (const flipSecondAxisSign of [false, true]) {
      const rawCandidate = buildPlanePoseCandidateRaw(
        homographyMatrix,
        homographySign,
        flipSecondAxisSign,
      );

      if (rawCandidate === null) {
        continue;
      }

      const objectPose = convertRawCandidateToObjectPose(rawCandidate, planeBasis);

      if (!hasPositiveDepthForObjectPoints(objectPose, objectPoints)) {
        continue;
      }

      poseCandidates.push(objectPose);
    }
  }

  return poseCandidates;
}
