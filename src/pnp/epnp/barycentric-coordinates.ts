/**
 * EPnP barycentric coordinates relative to control points.
 */
import { Matrix } from "ml-matrix";
import type { ObjectPoint3D } from "../../core/types.js";
import { invertMatrix3x3 } from "./linear-algebra.js";
import type { ControlPointSet } from "./control-points.js";

export type BarycentricCoordinate4 = readonly [number, number, number, number];

/** Computes barycentric coordinates that sum to 1 and reconstruct each object point. */
export function computeBarycentricCoordinates(
  objectPoints: ReadonlyArray<ObjectPoint3D>,
  controlPoints: ControlPointSet,
): BarycentricCoordinate4[] {
  const centroid = controlPoints[0];
  const controlPointMatrix = Matrix.zeros(3, 3);

  for (let columnIndex = 0; columnIndex < 3; columnIndex += 1) {
    const controlPoint = controlPoints[columnIndex + 1];

    if (controlPoint === undefined || centroid === undefined) {
      throw new RangeError("Control point is missing for barycentric computation.");
    }

    controlPointMatrix.set(0, columnIndex, controlPoint[0] - centroid[0]);
    controlPointMatrix.set(1, columnIndex, controlPoint[1] - centroid[1]);
    controlPointMatrix.set(2, columnIndex, controlPoint[2] - centroid[2]);
  }

  const inverseControlPointMatrix = invertMatrix3x3(controlPointMatrix);

  return objectPoints.map((objectPoint) => {
    const relativeX = objectPoint[0] - centroid[0];
    const relativeY = objectPoint[1] - centroid[1];
    const relativeZ = objectPoint[2] - centroid[2];

    const alpha1 =
      inverseControlPointMatrix.get(0, 0) * relativeX +
      inverseControlPointMatrix.get(0, 1) * relativeY +
      inverseControlPointMatrix.get(0, 2) * relativeZ;
    const alpha2 =
      inverseControlPointMatrix.get(1, 0) * relativeX +
      inverseControlPointMatrix.get(1, 1) * relativeY +
      inverseControlPointMatrix.get(1, 2) * relativeZ;
    const alpha3 =
      inverseControlPointMatrix.get(2, 0) * relativeX +
      inverseControlPointMatrix.get(2, 1) * relativeY +
      inverseControlPointMatrix.get(2, 2) * relativeZ;
    const alpha0 = 1 - alpha1 - alpha2 - alpha3;

    return [alpha0, alpha1, alpha2, alpha3] as BarycentricCoordinate4;
  });
}

/** Reconstructs an object point from barycentric coordinates and control points. */
export function reconstructObjectPointFromBarycentricCoordinates(
  barycentricCoordinate: BarycentricCoordinate4,
  controlPoints: ControlPointSet,
): ObjectPoint3D {
  let reconstructedX = 0;
  let reconstructedY = 0;
  let reconstructedZ = 0;

  for (let controlIndex = 0; controlIndex < 4; controlIndex += 1) {
    const controlPoint = controlPoints[controlIndex];
    const weight = barycentricCoordinate[controlIndex] ?? 0;

    if (controlPoint === undefined) {
      throw new RangeError("Control point is missing for reconstruction.");
    }

    reconstructedX += weight * controlPoint[0];
    reconstructedY += weight * controlPoint[1];
    reconstructedZ += weight * controlPoint[2];
  }

  return [reconstructedX, reconstructedY, reconstructedZ];
}
