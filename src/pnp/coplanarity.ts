/**
 * Coplanarity detection for planar pose routing.
 */
import type { ObjectPoint3D } from "../core/types.js";
import { checkGeometryDegeneracy } from "./geometry-degeneracy.js";

/** Returns whether object points lie on a single plane (coplanar but not collinear). */
export function areObjectPointsCoplanar(
  objectPoints: ReadonlyArray<ObjectPoint3D>,
): boolean {
  const degeneracyCheck = checkGeometryDegeneracy(objectPoints);

  if (degeneracyCheck.reason === "notEnoughPoints") {
    return false;
  }

  return degeneracyCheck.isDegenerate;
}
