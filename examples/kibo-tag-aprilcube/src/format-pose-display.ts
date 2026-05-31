/**
 * Formats cameraFromObject pose translation and orientation for the example UI.
 */
import {
  quaternionToRotationMatrix,
  quaternionToRotationVector,
  type Pose,
  type RowMajorMatrix3,
} from "kibo-track";

const RADIANS_TO_DEGREES = 180 / Math.PI;
const METERS_TO_MILLIMETERS = 1000;
const EULER_SINGULARITY_COSINE_EPSILON = 1e-6;

function clampUnitInterval(value: number): number {
  if (value < -1) {
    return -1;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function radiansToDegrees(radians: number): number {
  return radians * RADIANS_TO_DEGREES;
}

function formatDegrees(value: number): string {
  return value.toFixed(2);
}

/** Converts a row-major rotation matrix to ZYX Euler angles in degrees. */
export function rotationMatrixToEulerZyxDegrees(
  rotationMatrix: RowMajorMatrix3,
): readonly [number, number, number] {
  const rotationElementZeroZero = rotationMatrix[0];
  const rotationElementOneZero = rotationMatrix[3];
  const rotationElementTwoZero = rotationMatrix[6];
  const rotationElementZeroOne = rotationMatrix[1];
  const rotationElementOneOne = rotationMatrix[4];
  const rotationElementTwoOne = rotationMatrix[7];
  const rotationElementTwoTwo = rotationMatrix[8];

  const pitchRadians = Math.asin(-clampUnitInterval(rotationElementTwoZero));
  let yawRadians: number;
  let rollRadians: number;

  if (Math.abs(Math.cos(pitchRadians)) > EULER_SINGULARITY_COSINE_EPSILON) {
    yawRadians = Math.atan2(rotationElementOneZero, rotationElementZeroZero);
    rollRadians = Math.atan2(rotationElementTwoOne, rotationElementTwoTwo);
  } else {
    yawRadians = Math.atan2(-rotationElementZeroOne, rotationElementOneOne);
    rollRadians = 0;
  }

  return [
    radiansToDegrees(yawRadians),
    radiansToDegrees(pitchRadians),
    radiansToDegrees(rollRadians),
  ];
}

/** Returns human-readable pose orientation and translation lines for the UI. */
export function formatPoseDisplayLines(pose: Pose): string[] {
  const rotationVector = quaternionToRotationVector(pose.rotation);
  const rotationAngleRadians = Math.hypot(
    rotationVector[0],
    rotationVector[1],
    rotationVector[2],
  );
  const rotationMatrix = quaternionToRotationMatrix(pose.rotation);
  const [yawDegrees, pitchDegrees, rollDegrees] =
    rotationMatrixToEulerZyxDegrees(rotationMatrix);
  const [translationX, translationY, translationZ] = pose.translation;

  return [
    `Translation (mm): ${formatDegrees(translationX * METERS_TO_MILLIMETERS)}, ${formatDegrees(translationY * METERS_TO_MILLIMETERS)}, ${formatDegrees(translationZ * METERS_TO_MILLIMETERS)}`,
    `Euler ZYX (deg): yaw ${formatDegrees(yawDegrees)}, pitch ${formatDegrees(pitchDegrees)}, roll ${formatDegrees(rollDegrees)}`,
    `rvec (deg): ${formatDegrees(rotationVector[0] * RADIANS_TO_DEGREES)}, ${formatDegrees(rotationVector[1] * RADIANS_TO_DEGREES)}, ${formatDegrees(rotationVector[2] * RADIANS_TO_DEGREES)} · angle ${formatDegrees(rotationAngleRadians * RADIANS_TO_DEGREES)}`,
  ];
}
