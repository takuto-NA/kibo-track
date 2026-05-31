/**
 * EPnP substep diagnostics for focused unit tests (not part of public API).
 */
import { computeBarycentricCoordinates } from "../../src/pnp/epnp/barycentric-coordinates.js";
import { chooseControlPoints } from "../../src/pnp/epnp/control-points.js";
import type { EpnpSolveInput } from "../../src/pnp/epnp/epnp-solver.js";
import {
  buildMeasurementMatrix,
  computeNullSpaceBasis,
} from "../../src/pnp/epnp/measurement-matrix.js";
import type { CameraIntrinsics } from "../../src/core/types.js";

function buildEpnpCameraParameters(cameraIntrinsics: CameraIntrinsics) {
  return {
    focalLengthX: cameraIntrinsics.focalLengthX,
    focalLengthY: cameraIntrinsics.focalLengthY,
    principalPointX: cameraIntrinsics.principalPointX,
    principalPointY: cameraIntrinsics.principalPointY,
  };
}

/** Exposes EPnP substep outputs for focused unit tests. */
export function computeEpnpSubstepsForTests(input: EpnpSolveInput): {
  readonly controlPoints: ReturnType<typeof chooseControlPoints>;
  readonly barycentricCoordinates: ReturnType<typeof computeBarycentricCoordinates>;
  readonly measurementMatrixRows: number;
  readonly measurementMatrixColumns: number;
  readonly nullSpaceBasisLength: number;
} {
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

  return {
    controlPoints,
    barycentricCoordinates,
    measurementMatrixRows: measurementMatrix.rows,
    measurementMatrixColumns: measurementMatrix.columns,
    nullSpaceBasisLength: nullSpaceBasis.length,
  };
}
