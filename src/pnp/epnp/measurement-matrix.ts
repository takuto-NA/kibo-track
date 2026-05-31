/**
 * EPnP measurement matrix construction and null-space extraction.
 */
import { Matrix } from "ml-matrix";
import type { ImagePoint2D } from "../../core/types.js";
import { computeGramMatrix, computeSingularValueDecomposition } from "./linear-algebra.js";
import type { BarycentricCoordinate4 } from "./barycentric-coordinates.js";

export interface EpnpCameraParameters {
  readonly focalLengthX: number;
  readonly focalLengthY: number;
  readonly principalPointX: number;
  readonly principalPointY: number;
}

function fillMeasurementMatrixRows(
  measurementMatrix: Matrix,
  rowIndex: number,
  barycentricCoordinate: BarycentricCoordinate4,
  imagePoint: ImagePoint2D,
  cameraParameters: EpnpCameraParameters,
): void {
  const imageU = imagePoint[0];
  const imageV = imagePoint[1];

  for (let controlIndex = 0; controlIndex < 4; controlIndex += 1) {
    const alpha = barycentricCoordinate[controlIndex] ?? 0;
    const columnBase = controlIndex * 3;

    measurementMatrix.set(
      rowIndex,
      columnBase,
      alpha * cameraParameters.focalLengthX,
    );
    measurementMatrix.set(rowIndex, columnBase + 1, 0);
    measurementMatrix.set(
      rowIndex,
      columnBase + 2,
      alpha * (cameraParameters.principalPointX - imageU),
    );

    measurementMatrix.set(rowIndex + 1, columnBase, 0);
    measurementMatrix.set(
      rowIndex + 1,
      columnBase + 1,
      alpha * cameraParameters.focalLengthY,
    );
    measurementMatrix.set(
      rowIndex + 1,
      columnBase + 2,
      alpha * (cameraParameters.principalPointY - imageV),
    );
  }
}

/** Builds the 2N x 12 EPnP measurement matrix. */
export function buildMeasurementMatrix(
  imagePoints: ReadonlyArray<ImagePoint2D>,
  barycentricCoordinates: ReadonlyArray<BarycentricCoordinate4>,
  cameraParameters: EpnpCameraParameters,
): Matrix {
  if (imagePoints.length !== barycentricCoordinates.length) {
    throw new RangeError("Image points and barycentric coordinates must match.");
  }

  const correspondenceCount = imagePoints.length;
  const measurementMatrix = Matrix.zeros(2 * correspondenceCount, 12);

  for (let pointIndex = 0; pointIndex < correspondenceCount; pointIndex += 1) {
    const imagePoint = imagePoints[pointIndex];
    const barycentricCoordinate = barycentricCoordinates[pointIndex];

    if (imagePoint === undefined || barycentricCoordinate === undefined) {
      throw new RangeError("Correspondence is missing for measurement matrix row.");
    }

    fillMeasurementMatrixRows(
      measurementMatrix,
      2 * pointIndex,
      barycentricCoordinate,
      imagePoint,
      cameraParameters,
    );
  }

  return measurementMatrix;
}

/** Computes the 12x12 null-space basis rows used by EPnP beta solving. */
export function computeNullSpaceBasis(
  measurementMatrix: Matrix,
): readonly number[] {
  const gramMatrix = computeGramMatrix(measurementMatrix);
  const { rightSingularVectorsTransposed } = computeSingularValueDecomposition(gramMatrix);
  return rightSingularVectorsTransposed.to1DArray();
}
