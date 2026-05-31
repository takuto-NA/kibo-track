/**
 * Pixel-space residual construction for LM pose refinement.
 */
import { projectPoints } from "../core/project-points.js";
import type {
  CameraIntrinsics,
  ImagePoint2D,
  ObjectPoint3D,
} from "../core/types.js";
import { INVALID_PROJECTION_RESIDUAL_PENALTY_PX } from "./constants.js";
import { parameterVectorToPose } from "./pose-parameters.js";

function createInvalidProjectionPenaltyResiduals(residualCount: number): Float64Array {
  return new Float64Array(residualCount).fill(INVALID_PROJECTION_RESIDUAL_PENALTY_PX);
}

function computePixelResiduals(
  objectPoints: ReadonlyArray<ObjectPoint3D>,
  observedImagePoints: ReadonlyArray<ImagePoint2D>,
  cameraIntrinsics: CameraIntrinsics,
  trialPoseParameters: Float64Array,
): Float64Array {
  const residualCount = objectPoints.length * 2;
  const trialPose = parameterVectorToPose(trialPoseParameters);
  const projectedImagePoints = projectPoints(
    objectPoints,
    trialPose,
    cameraIntrinsics,
  );
  const residuals = new Float64Array(residualCount);

  for (let pointIndex = 0; pointIndex < objectPoints.length; pointIndex += 1) {
    const projectedPoint = projectedImagePoints[pointIndex];
    const observedPoint = observedImagePoints[pointIndex];

    if (projectedPoint === undefined || observedPoint === undefined) {
      return createInvalidProjectionPenaltyResiduals(residualCount);
    }

    const residualIndex = pointIndex * 2;
    residuals[residualIndex] = projectedPoint[0] - observedPoint[0];
    residuals[residualIndex + 1] = projectedPoint[1] - observedPoint[1];
  }

  return residuals;
}

/** Builds a pixel-space residual function for numopt-js. */
export function buildRefinementResidualFunction(
  objectPoints: ReadonlyArray<ObjectPoint3D>,
  observedImagePoints: ReadonlyArray<ImagePoint2D>,
  cameraIntrinsics: CameraIntrinsics,
): (parameters: Float64Array) => Float64Array {
  const residualCount = objectPoints.length * 2;

  return (parameters: Float64Array): Float64Array => {
    try {
      return computePixelResiduals(
        objectPoints,
        observedImagePoints,
        cameraIntrinsics,
        parameters,
      );
    } catch {
      // Guard: trial poses may project points behind the camera during optimization.
      return createInvalidProjectionPenaltyResiduals(residualCount);
    }
  };
}
