/**
 * Row-major 3x3 matrix helpers with column-vector math semantics.
 */
import type { RowMajorMatrix3 } from "./types.js";

/** Multiplies two row-major 3x3 matrices. */
export function multiplyRowMajorMatrix3(
  leftMatrix: RowMajorMatrix3,
  rightMatrix: RowMajorMatrix3,
): RowMajorMatrix3 {
  const element00 =
    leftMatrix[0]! * rightMatrix[0]! +
    leftMatrix[1]! * rightMatrix[3]! +
    leftMatrix[2]! * rightMatrix[6]!;
  const element01 =
    leftMatrix[0]! * rightMatrix[1]! +
    leftMatrix[1]! * rightMatrix[4]! +
    leftMatrix[2]! * rightMatrix[7]!;
  const element02 =
    leftMatrix[0]! * rightMatrix[2]! +
    leftMatrix[1]! * rightMatrix[5]! +
    leftMatrix[2]! * rightMatrix[8]!;
  const element10 =
    leftMatrix[3]! * rightMatrix[0]! +
    leftMatrix[4]! * rightMatrix[3]! +
    leftMatrix[5]! * rightMatrix[6]!;
  const element11 =
    leftMatrix[3]! * rightMatrix[1]! +
    leftMatrix[4]! * rightMatrix[4]! +
    leftMatrix[5]! * rightMatrix[7]!;
  const element12 =
    leftMatrix[3]! * rightMatrix[2]! +
    leftMatrix[4]! * rightMatrix[5]! +
    leftMatrix[5]! * rightMatrix[8]!;
  const element20 =
    leftMatrix[6]! * rightMatrix[0]! +
    leftMatrix[7]! * rightMatrix[3]! +
    leftMatrix[8]! * rightMatrix[6]!;
  const element21 =
    leftMatrix[6]! * rightMatrix[1]! +
    leftMatrix[7]! * rightMatrix[4]! +
    leftMatrix[8]! * rightMatrix[7]!;
  const element22 =
    leftMatrix[6]! * rightMatrix[2]! +
    leftMatrix[7]! * rightMatrix[5]! +
    leftMatrix[8]! * rightMatrix[8]!;

  return [
    element00,
    element01,
    element02,
    element10,
    element11,
    element12,
    element20,
    element21,
    element22,
  ];
}

/** Adds two row-major 3x3 matrices element-wise. */
export function addRowMajorMatrix3(
  leftMatrix: RowMajorMatrix3,
  rightMatrix: RowMajorMatrix3,
): RowMajorMatrix3 {
  return [
    leftMatrix[0]! + rightMatrix[0]!,
    leftMatrix[1]! + rightMatrix[1]!,
    leftMatrix[2]! + rightMatrix[2]!,
    leftMatrix[3]! + rightMatrix[3]!,
    leftMatrix[4]! + rightMatrix[4]!,
    leftMatrix[5]! + rightMatrix[5]!,
    leftMatrix[6]! + rightMatrix[6]!,
    leftMatrix[7]! + rightMatrix[7]!,
    leftMatrix[8]! + rightMatrix[8]!,
  ];
}

/** Scales a row-major 3x3 matrix by a scalar. */
export function scaleRowMajorMatrix3(
  matrix: RowMajorMatrix3,
  scale: number,
): RowMajorMatrix3 {
  return [
    matrix[0]! * scale,
    matrix[1]! * scale,
    matrix[2]! * scale,
    matrix[3]! * scale,
    matrix[4]! * scale,
    matrix[5]! * scale,
    matrix[6]! * scale,
    matrix[7]! * scale,
    matrix[8]! * scale,
  ];
}

/** Builds a skew-symmetric matrix from a normalized rotation axis. */
export function createSkewSymmetricMatrix(
  axisX: number,
  axisY: number,
  axisZ: number,
): RowMajorMatrix3 {
  return [0, -axisZ, axisY, axisZ, 0, -axisX, -axisY, axisX, 0];
}

/** Applies a row-major 3x3 rotation and translation to an object-space point. */
export function transformObjectPointWithRotationMatrix(
  objectPointX: number,
  objectPointY: number,
  objectPointZ: number,
  rotationMatrix: RowMajorMatrix3,
  translationX: number,
  translationY: number,
  translationZ: number,
): readonly [number, number, number] {
  const cameraPointX =
    rotationMatrix[0]! * objectPointX +
    rotationMatrix[1]! * objectPointY +
    rotationMatrix[2]! * objectPointZ +
    translationX;
  const cameraPointY =
    rotationMatrix[3]! * objectPointX +
    rotationMatrix[4]! * objectPointY +
    rotationMatrix[5]! * objectPointZ +
    translationY;
  const cameraPointZ =
    rotationMatrix[6]! * objectPointX +
    rotationMatrix[7]! * objectPointY +
    rotationMatrix[8]! * objectPointZ +
    translationZ;

  return [cameraPointX, cameraPointY, cameraPointZ];
}
