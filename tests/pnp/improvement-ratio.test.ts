/**
 * Diagnostic tests for improvement ratio computation.
 */
import { describe, expect, it } from "vitest";
import { computeImprovementRatio } from "../../src/pnp/improvement-ratio.js";

describe("computeImprovementRatio", () => {
  it("returns 1 when both initial and final errors are zero", () => {
    expect(computeImprovementRatio(0, 0)).toBe(1);
  });

  it("computes ratio from initial and final mean errors", () => {
    expect(computeImprovementRatio(10, 2)).toBeCloseTo(0.8, 6);
  });

  it("returns 0 when initial error is zero but final error remains", () => {
    expect(computeImprovementRatio(0, 1)).toBe(0);
  });
});
