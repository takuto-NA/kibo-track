/**
 * Internal conversion between public Pose and LM parameter vectors.
 */
import {
  quaternionToRotationVector,
  rotationVectorToQuaternion,
} from "../core/rodrigues.js";
import type { Pose, RotationVector, Vector3 } from "../core/types.js";
import { POSE_PARAMETER_COUNT } from "./constants.js";

/** Rotation vector and translation used internally by the LM optimizer. */
export interface RodriguesTranslationParameters {
  readonly rotationVector: RotationVector;
  readonly translation: Vector3;
}

/** Converts a public pose to Rodrigues vector plus translation. */
export function poseToRodriguesTranslationParameters(
  pose: Pose,
): RodriguesTranslationParameters {
  return {
    rotationVector: quaternionToRotationVector(pose.rotation),
    translation: pose.translation,
  };
}

/** Converts Rodrigues vector plus translation to a public pose. */
export function rodriguesTranslationParametersToPose(
  parameters: RodriguesTranslationParameters,
): Pose {
  return {
    rotation: rotationVectorToQuaternion(parameters.rotationVector),
    translation: parameters.translation,
  };
}

/** Packs a pose into a 6-element LM parameter vector. */
export function poseToParameterVector(pose: Pose): Float64Array {
  const { rotationVector, translation } = poseToRodriguesTranslationParameters(pose);

  return new Float64Array([
    rotationVector[0],
    rotationVector[1],
    rotationVector[2],
    translation[0],
    translation[1],
    translation[2],
  ]);
}

/** Unpacks a 6-element LM parameter vector into a public pose. */
export function parameterVectorToPose(parameters: Float64Array): Pose {
  if (parameters.length !== POSE_PARAMETER_COUNT) {
    throw new RangeError("Parameter vector must contain exactly six values.");
  }

  return rodriguesTranslationParametersToPose({
    rotationVector: [parameters[0]!, parameters[1]!, parameters[2]!],
    translation: [parameters[3]!, parameters[4]!, parameters[5]!],
  });
}
