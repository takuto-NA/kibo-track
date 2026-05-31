/**
 * Internal linear algebra helpers for EPnP (not exported publicly).
 */
import { Matrix, solve, SVD } from "ml-matrix";

/** Solves an overdetermined linear system using SVD least squares. */
export function solveLinearSystemLeastSquares(
  coefficientMatrix: Matrix,
  dependentVector: Matrix,
): Matrix {
  return solve(coefficientMatrix, dependentVector, true);
}

/** Computes SVD of a matrix and returns V transposed for null-space extraction. */
export function computeSingularValueDecomposition(matrix: Matrix): {
  readonly rightSingularVectorsTransposed: Matrix;
} {
  const singularValueDecomposition = new SVD(matrix, { autoTranspose: true });
  const rightSingularVectorsTransposed =
    singularValueDecomposition.rightSingularVectors.transpose();

  return {
    rightSingularVectorsTransposed,
  };
}

/** Computes M^T M for a measurement matrix. */
export function computeGramMatrix(measurementMatrix: Matrix): Matrix {
  return measurementMatrix.transpose().mmul(measurementMatrix);
}

/** Computes a 3x3 matrix inverse via SVD. */
export function invertMatrix3x3(matrix3x3: Matrix): Matrix {
  return solve(matrix3x3, Matrix.eye(3), true);
}

/** Dot product of two length-3 vectors stored as arrays. */
export function dotProduct3(
  firstVector: readonly [number, number, number],
  secondVector: readonly [number, number, number],
): number {
  return (
    firstVector[0] * secondVector[0] +
    firstVector[1] * secondVector[1] +
    firstVector[2] * secondVector[2]
  );
}
