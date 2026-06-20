/**
 * Per-cube color palette for the multi-cube overlay (16 distinct HSL hues).
 */
import { MULTI_CUBE_CONFIG_COUNT } from "./constants.js";

const PALETTE_HUE_DEGREES_PER_CUBE = 360 / MULTI_CUBE_CONFIG_COUNT;
const PALETTE_SATURATION_PERCENT = 85;
const PALETTE_LIGHTNESS_PERCENT = 55;

/** Returns a stable HSL color string for the given cube index (0..15). */
export function buildCubeColor(cubeIndex: number): string {
  if (!Number.isInteger(cubeIndex) || cubeIndex < 0 || cubeIndex >= MULTI_CUBE_CONFIG_COUNT) {
    throw new RangeError(`Cube index ${cubeIndex} is out of multi-cube range.`);
  }

  const hueDegrees = cubeIndex * PALETTE_HUE_DEGREES_PER_CUBE;

  return `hsl(${hueDegrees.toFixed(0)}, ${PALETTE_SATURATION_PERCENT}%, ${PALETTE_LIGHTNESS_PERCENT}%)`;
}

/** Returns the full 16-entry color palette in cube-index order. */
export function buildMultiCubePalette(): readonly string[] {
  const palette: string[] = [];

  for (let cubeIndex = 0; cubeIndex < MULTI_CUBE_CONFIG_COUNT; cubeIndex += 1) {
    palette.push(buildCubeColor(cubeIndex));
  }

  return palette;
}
