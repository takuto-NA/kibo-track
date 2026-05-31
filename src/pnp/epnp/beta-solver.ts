/**
 * EPnP beta coefficient solving via approximate solutions and Gauss-Newton refinement.
 */
import { Matrix } from "ml-matrix";
import { EPNP_GAUSS_NEWTON_ITERATION_COUNT } from "../constants.js";
import { dotProduct3, solveLinearSystemLeastSquares } from "./linear-algebra.js";

const L6X10_COLUMN_INDICES_FOR_APPROX_1 = [0, 1, 3, 6] as const;
const L6X10_COLUMN_INDICES_FOR_APPROX_2 = [0, 1, 2] as const;
const L6X10_COLUMN_INDICES_FOR_APPROX_3 = [0, 1, 2, 3, 4] as const;

function extractSubMatrixColumns(
  sourceMatrix: Matrix,
  columnIndices: ReadonlyArray<number>,
): Matrix {
  const subMatrix = Matrix.zeros(sourceMatrix.rows, columnIndices.length);

  for (let rowIndex = 0; rowIndex < sourceMatrix.rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columnIndices.length; columnIndex += 1) {
      const sourceColumnIndex = columnIndices[columnIndex];

      if (sourceColumnIndex === undefined) {
        throw new RangeError("Column index is missing for submatrix extraction.");
      }

      subMatrix.set(rowIndex, columnIndex, sourceMatrix.get(rowIndex, sourceColumnIndex));
    }
  }

  return subMatrix;
}

function computeDifferenceVectors(
  nullSpaceBasis: readonly number[],
): readonly (readonly [number, number, number])[][] {
  const basisVectors = [
    nullSpaceBasis.slice(12 * 11, 12 * 12),
    nullSpaceBasis.slice(12 * 10, 12 * 11),
    nullSpaceBasis.slice(12 * 9, 12 * 10),
    nullSpaceBasis.slice(12 * 8, 12 * 9),
  ];

  const differenceVectors: [number, number, number][][] = [];

  for (let vectorIndex = 0; vectorIndex < 4; vectorIndex += 1) {
    const basisVector = basisVectors[vectorIndex];

    if (basisVector === undefined) {
      throw new RangeError("Null-space basis vector is missing.");
    }

    const pairDifferences: [number, number, number][] = [];
    let firstControlIndex = 0;
    let secondControlIndex = 1;

    for (let pairIndex = 0; pairIndex < 6; pairIndex += 1) {
      const firstBase = firstControlIndex * 3;
      const secondBase = secondControlIndex * 3;

      pairDifferences.push([
        basisVector[firstBase]! - basisVector[secondBase]!,
        basisVector[firstBase + 1]! - basisVector[secondBase + 1]!,
        basisVector[firstBase + 2]! - basisVector[secondBase + 2]!,
      ]);

      secondControlIndex += 1;
      if (secondControlIndex > 3) {
        firstControlIndex += 1;
        secondControlIndex = firstControlIndex + 1;
      }
    }

    differenceVectors.push(pairDifferences);
  }

  return differenceVectors;
}

/** Builds the 6x10 L matrix used to solve EPnP beta coefficients. */
export function computeL6x10(nullSpaceBasis: readonly number[]): Matrix {
  const differenceVectors = computeDifferenceVectors(nullSpaceBasis);
  const lMatrix = Matrix.zeros(6, 10);

  for (let pairIndex = 0; pairIndex < 6; pairIndex += 1) {
    const dv0 = differenceVectors[0]?.[pairIndex];
    const dv1 = differenceVectors[1]?.[pairIndex];
    const dv2 = differenceVectors[2]?.[pairIndex];
    const dv3 = differenceVectors[3]?.[pairIndex];

    if (dv0 === undefined || dv1 === undefined || dv2 === undefined || dv3 === undefined) {
      throw new RangeError("Difference vector is missing for L matrix row.");
    }

    lMatrix.set(pairIndex, 0, dotProduct3(dv0, dv0));
    lMatrix.set(pairIndex, 1, 2 * dotProduct3(dv0, dv1));
    lMatrix.set(pairIndex, 2, dotProduct3(dv1, dv1));
    lMatrix.set(pairIndex, 3, 2 * dotProduct3(dv0, dv2));
    lMatrix.set(pairIndex, 4, 2 * dotProduct3(dv1, dv2));
    lMatrix.set(pairIndex, 5, dotProduct3(dv2, dv2));
    lMatrix.set(pairIndex, 6, 2 * dotProduct3(dv0, dv3));
    lMatrix.set(pairIndex, 7, 2 * dotProduct3(dv1, dv3));
    lMatrix.set(pairIndex, 8, 2 * dotProduct3(dv2, dv3));
    lMatrix.set(pairIndex, 9, dotProduct3(dv3, dv3));
  }

  return lMatrix;
}

/** Builds the rho vector from control point pair distances. */
export function buildRhoVector(controlPointDistances: readonly number[]): Matrix {
  return Matrix.columnVector(controlPointDistances);
}

function computeGaussNewtonJacobianRow(
  lRow: readonly number[],
  betas: readonly [number, number, number, number],
): readonly [number, number, number, number] {
  const [beta0, beta1, beta2, beta3] = betas;

  return [
    2 * lRow[0]! * beta0 + lRow[1]! * beta1 + lRow[3]! * beta2 + lRow[6]! * beta3,
    lRow[1]! * beta0 + 2 * lRow[2]! * beta1 + lRow[4]! * beta2 + lRow[7]! * beta3,
    lRow[3]! * beta0 + lRow[4]! * beta1 + 2 * lRow[5]! * beta2 + lRow[8]! * beta3,
    lRow[6]! * beta0 + lRow[7]! * beta1 + lRow[8]! * beta2 + 2 * lRow[9]! * beta3,
  ];
}

function evaluateQuadraticForm(
  lRow: readonly number[],
  betas: readonly [number, number, number, number],
): number {
  const [beta0, beta1, beta2, beta3] = betas;

  return (
    lRow[0]! * beta0 * beta0 +
    lRow[1]! * beta0 * beta1 +
    lRow[2]! * beta1 * beta1 +
    lRow[3]! * beta0 * beta2 +
    lRow[4]! * beta1 * beta2 +
    lRow[5]! * beta2 * beta2 +
    lRow[6]! * beta0 * beta3 +
    lRow[7]! * beta1 * beta3 +
    lRow[8]! * beta2 * beta3 +
    lRow[9]! * beta3 * beta3
  );
}

function refineBetasGaussNewton(
  lMatrix: Matrix,
  rhoVector: Matrix,
  betas: [number, number, number, number],
): void {
  for (let iterationIndex = 0; iterationIndex < EPNP_GAUSS_NEWTON_ITERATION_COUNT; iterationIndex += 1) {
    const jacobianMatrix = Matrix.zeros(6, 4);
    const residualVector = Matrix.zeros(6, 1);

    for (let rowIndex = 0; rowIndex < 6; rowIndex += 1) {
      const lRow = lMatrix.getRow(rowIndex);
      const jacobianRow = computeGaussNewtonJacobianRow(lRow, betas);

      jacobianMatrix.setRow(rowIndex, [...jacobianRow]);
      residualVector.set(
        rowIndex,
        0,
        rhoVector.get(rowIndex, 0) - evaluateQuadraticForm(lRow, betas),
      );
    }

    const deltaVector = solveLinearSystemLeastSquares(jacobianMatrix, residualVector);
    betas[0] += deltaVector.get(0, 0);
    betas[1] += deltaVector.get(1, 0);
    betas[2] += deltaVector.get(2, 0);
    betas[3] += deltaVector.get(3, 0);
  }
}

function assignBetasFromLinearSolution(
  linearSolution: Matrix,
  betas: [number, number, number, number],
  mode: "approx1" | "approx2" | "approx3",
): void {
  if (mode === "approx1") {
    const solution0 = linearSolution.get(0, 0);
    const solution1 = linearSolution.get(1, 0);
    const solution2 = linearSolution.get(2, 0);
    const solution3 = linearSolution.get(3, 0);

    if (solution0 < 0) {
      betas[0] = Math.sqrt(-solution0);
      betas[1] = -solution1 / betas[0];
      betas[2] = -solution2 / betas[0];
      betas[3] = -solution3 / betas[0];
      return;
    }

    betas[0] = Math.sqrt(solution0);
    betas[1] = solution1 / betas[0];
    betas[2] = solution2 / betas[0];
    betas[3] = solution3 / betas[0];
    return;
  }

  if (mode === "approx2") {
    const solution0 = linearSolution.get(0, 0);
    const solution1 = linearSolution.get(1, 0);
    const solution2 = linearSolution.get(2, 0);

    if (solution0 < 0) {
      betas[0] = Math.sqrt(-solution0);
      betas[1] = solution2 < 0 ? Math.sqrt(-solution2) : 0;
    } else {
      betas[0] = Math.sqrt(solution0);
      betas[1] = solution2 > 0 ? Math.sqrt(solution2) : 0;
    }

    if (solution1 < 0) {
      betas[0] = -betas[0];
    }

    betas[2] = 0;
    betas[3] = 0;
    return;
  }

  const solution0 = linearSolution.get(0, 0);
  const solution1 = linearSolution.get(1, 0);
  const solution2 = linearSolution.get(2, 0);
  const solution3 = linearSolution.get(3, 0);

  if (solution0 < 0) {
    betas[0] = Math.sqrt(-solution0);
    betas[1] = solution2 < 0 ? Math.sqrt(-solution2) : 0;
  } else {
    betas[0] = Math.sqrt(solution0);
    betas[1] = solution2 > 0 ? Math.sqrt(solution2) : 0;
  }

  if (solution1 < 0) {
    betas[0] = -betas[0];
  }

  betas[2] = solution3 / betas[0];
  betas[3] = 0;
}

function findBetasApprox1(
  lMatrix: Matrix,
  rhoVector: Matrix,
): [number, number, number, number] {
  const betas: [number, number, number, number] = [0, 0, 0, 0];
  const subMatrix = extractSubMatrixColumns(lMatrix, [...L6X10_COLUMN_INDICES_FOR_APPROX_1]);
  const linearSolution = solveLinearSystemLeastSquares(subMatrix, rhoVector);
  assignBetasFromLinearSolution(linearSolution, betas, "approx1");
  refineBetasGaussNewton(lMatrix, rhoVector, betas);
  return betas;
}

function findBetasApprox2(
  lMatrix: Matrix,
  rhoVector: Matrix,
): [number, number, number, number] {
  const betas: [number, number, number, number] = [0, 0, 0, 0];
  const subMatrix = extractSubMatrixColumns(lMatrix, [...L6X10_COLUMN_INDICES_FOR_APPROX_2]);
  const linearSolution = solveLinearSystemLeastSquares(subMatrix, rhoVector);
  assignBetasFromLinearSolution(linearSolution, betas, "approx2");
  refineBetasGaussNewton(lMatrix, rhoVector, betas);
  return betas;
}

function findBetasApprox3(
  lMatrix: Matrix,
  rhoVector: Matrix,
): [number, number, number, number] {
  const betas: [number, number, number, number] = [0, 0, 0, 0];
  const subMatrix = extractSubMatrixColumns(lMatrix, [...L6X10_COLUMN_INDICES_FOR_APPROX_3]);
  const linearSolution = solveLinearSystemLeastSquares(subMatrix, rhoVector);
  assignBetasFromLinearSolution(linearSolution, betas, "approx3");
  refineBetasGaussNewton(lMatrix, rhoVector, betas);
  return betas;
}

/** Finds three beta approximations and returns them for pose recovery selection. */
export function findBetaCandidates(
  lMatrix: Matrix,
  rhoVector: Matrix,
): readonly [number, number, number, number][] {
  return [
    findBetasApprox1(lMatrix, rhoVector),
    findBetasApprox2(lMatrix, rhoVector),
    findBetasApprox3(lMatrix, rhoVector),
  ];
}
