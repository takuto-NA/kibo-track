/**
 * User-reported consecutive pose frames that exposed quaternion lerp spin in live tracking.
 */
import { rotationVectorToQuaternion, type Pose } from "kibo-track";

const DEGREES_TO_RADIANS = Math.PI / 180;

function rotationVectorFromDegrees(
  rotationVectorDegrees: readonly [number, number, number],
): readonly [number, number, number] {
  return [
    rotationVectorDegrees[0] * DEGREES_TO_RADIANS,
    rotationVectorDegrees[1] * DEGREES_TO_RADIANS,
    rotationVectorDegrees[2] * DEGREES_TO_RADIANS,
  ];
}

/** Frame A rvec (deg) from 2026-05-31 multiFace markers 1,4 live tracking. */
export const USER_REPORTED_RVEC_A_DEGREES: readonly [number, number, number] = [
  156.28, -36.06, 78.49,
];

/** Frame B rvec (deg) from the following live tracking frame. */
export const USER_REPORTED_RVEC_B_DEGREES: readonly [number, number, number] = [
  -148.21, 51.92, -81.95,
];

export const USER_REPORTED_FRAME_A_POSE: Pose = {
  rotation: rotationVectorToQuaternion(rotationVectorFromDegrees(USER_REPORTED_RVEC_A_DEGREES)),
  translation: [-0.06097, 0.01904, 0.43991],
};

export const USER_REPORTED_FRAME_B_POSE: Pose = {
  rotation: rotationVectorToQuaternion(rotationVectorFromDegrees(USER_REPORTED_RVEC_B_DEGREES)),
  translation: [-0.06548, 0.00948, 0.4627],
};
