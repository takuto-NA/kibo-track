/**
 * Direct linear transform homography estimation for planar correspondences.
 */
import { EigenvalueDecomposition, Matrix } from "ml-matrix";
import type { HomographyMatrix3x3 } from "./types.js";

const HOMOGRAPHY_MATRIX_ELEMENT_COUNT = 9;
const HOMOGRAPHY_NORMALIZATION_INDEX = 8;

function selectSmallestEigenvalueIndex(eigenvalues: ReadonlyArray<number>): number {
  let smallestEigenvalueIndex = 0;

  for (let eigenvalueIndex = 1; eigenvalueIndex < eigenvalues.length; eigenvalueIndex += 1) {
    const eigenvalue = eigenvalues[eigenvalueIndex];
    const currentSmallestEigenvalue = eigenvalues[smallestEigenvalueIndex];

    if (
      eigenvalue !== undefined &&
      currentSmallestEigenvalue !== undefined &&
      eigenvalue < currentSmallestEigenvalue
    ) {
      smallestEigenvalueIndex = eigenvalueIndex;
    }
  }

  return smallestEigenvalueIndex;
}

function buildHomographyDesignRow(
  planeCoordinateU: number,
  planeCoordinateV: number,
  normalizedImageX: number,
  normalizedImageY: number,
  rowOffset: number,
): number[] {
  const designRow = new Array<number>(HOMOGRAPHY_MATRIX_ELEMENT_COUNT).fill(0);

  if (rowOffset === 0) {
    designRow[0] = -planeCoordinateU;
    designRow[1] = -planeCoordinateV;
    designRow[2] = -1;
    designRow[6] = normalizedImageX * planeCoordinateU;
    designRow[7] = normalizedImageX * planeCoordinateV;
    designRow[8] = normalizedImageX;
    return designRow;
  }

  designRow[3] = -planeCoordinateU;
  designRow[4] = -planeCoordinateV;
  designRow[5] = -1;
  designRow[6] = normalizedImageY * planeCoordinateU;
  designRow[7] = normalizedImageY * planeCoordinateV;
  designRow[8] = normalizedImageY;
  return designRow;
}

/** Estimates a 3x3 homography mapping plane coordinates to normalized image coordinates. */
export function estimateHomographyFromCorrespondences(
  planeCoordinates2D: ReadonlyArray<readonly [number, number]>,
  normalizedImagePoints: ReadonlyArray<readonly [number, number]>,
): HomographyMatrix3x3 {
  if (planeCoordinates2D.length !== normalizedImagePoints.length) {
    throw new RangeError("Plane and image point counts must match for homography estimation.");
  }

  if (planeCoordinates2D.length < 4) {
    throw new RangeError("At least four correspondences are required for homography estimation.");
  }

  const designRows: number[][] = [];

  for (let correspondenceIndex = 0; correspondenceIndex < planeCoordinates2D.length; correspondenceIndex += 1) {
    const planeCoordinate = planeCoordinates2D[correspondenceIndex];
    const normalizedImagePoint = normalizedImagePoints[correspondenceIndex];

    if (planeCoordinate === undefined || normalizedImagePoint === undefined) {
      throw new RangeError("Missing correspondence during homography estimation.");
    }

    designRows.push(
      buildHomographyDesignRow(
        planeCoordinate[0],
        planeCoordinate[1],
        normalizedImagePoint[0],
        normalizedImagePoint[1],
        0,
      ),
    );
    designRows.push(
      buildHomographyDesignRow(
        planeCoordinate[0],
        planeCoordinate[1],
        normalizedImagePoint[0],
        normalizedImagePoint[1],
        1,
      ),
    );
  }

  const designMatrix = new Matrix(designRows);
  const normalMatrix = designMatrix.transpose().mmul(designMatrix);
  const eigenvalueDecomposition = new EigenvalueDecomposition(normalMatrix, {
    assumeSymmetric: true,
  });
  const homographyVector = eigenvalueDecomposition.eigenvectorMatrix.getColumn(
    selectSmallestEigenvalueIndex(eigenvalueDecomposition.realEigenvalues),
  );
  const normalizationValue = homographyVector[HOMOGRAPHY_NORMALIZATION_INDEX] ?? 1;

  if (Math.abs(normalizationValue) <= Number.EPSILON) {
    throw new RangeError("Homography normalization element is zero.");
  }

  return [
    (homographyVector[0] ?? 0) / normalizationValue,
    (homographyVector[1] ?? 0) / normalizationValue,
    (homographyVector[2] ?? 0) / normalizationValue,
    (homographyVector[3] ?? 0) / normalizationValue,
    (homographyVector[4] ?? 0) / normalizationValue,
    (homographyVector[5] ?? 0) / normalizationValue,
    (homographyVector[6] ?? 0) / normalizationValue,
    (homographyVector[7] ?? 0) / normalizationValue,
    (homographyVector[8] ?? 0) / normalizationValue,
  ];
}
