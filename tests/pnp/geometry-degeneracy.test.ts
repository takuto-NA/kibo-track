/**
 * Tests for degenerate geometry rejection before EPnP.
 */
import { describe, expect, it } from "vitest";
import { checkGeometryDegeneracy } from "../../src/pnp/geometry-degeneracy.js";
import { NON_COPLANAR_OBJECT_POINTS } from "../fixtures/estimate-pose-correspondences.js";
import { WELL_SPREAD_OBJECT_POINTS } from "../fixtures/refinement-correspondences.js";

describe("geometry degeneracy checks", () => {
  it("rejects fewer than four object points", () => {
    const result = checkGeometryDegeneracy(WELL_SPREAD_OBJECT_POINTS.slice(0, 3));

    expect(result.isDegenerate).toBe(true);
    expect(result.reason).toBe("notEnoughPoints");
  });

  it("rejects duplicate object points", () => {
    const duplicatedPoints = [
      ...NON_COPLANAR_OBJECT_POINTS.slice(0, 3),
      NON_COPLANAR_OBJECT_POINTS[0]!,
    ];

    const result = checkGeometryDegeneracy(duplicatedPoints);

    expect(result.isDegenerate).toBe(true);
    expect(result.reason).toBe("degenerateConfiguration");
  });

  it("rejects collinear object points", () => {
    const collinearPoints = [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [3, 0, 0],
    ] as const;

    const result = checkGeometryDegeneracy(collinearPoints);

    expect(result.isDegenerate).toBe(true);
    expect(result.reason).toBe("degenerateConfiguration");
  });

  it("rejects coplanar object points for v0.3 non-coplanar EPnP", () => {
    const coplanarPoints = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [0.5, 0.5, 0],
    ] as const;

    const result = checkGeometryDegeneracy(coplanarPoints);

    expect(result.isDegenerate).toBe(true);
    expect(result.reason).toBe("degenerateConfiguration");
  });

  it("accepts well-spread non-coplanar points", () => {
    const result = checkGeometryDegeneracy(NON_COPLANAR_OBJECT_POINTS);

    expect(result.isDegenerate).toBe(false);
  });
});
