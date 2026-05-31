/**
 * Deterministic pseudo-random sampling for RANSAC correspondence subsets.
 */
export class DeterministicRandomNumberGenerator {
  private currentSeed: number;

  public constructor(seed: number) {
    this.currentSeed = seed >>> 0;
  }

  /** Returns a pseudo-random float in [0, 1). */
  public nextUnitInterval(): number {
    this.currentSeed = (1664525 * this.currentSeed + 1013904223) >>> 0;
    return this.currentSeed / 0x100000000;
  }

  /** Samples `sampleSize` unique indices from `[0, populationSize)`. */
  public sampleUniqueIndices(populationSize: number, sampleSize: number): number[] {
    if (sampleSize > populationSize) {
      throw new RangeError("Sample size cannot exceed population size.");
    }

    const selectedIndices: number[] = [];

    while (selectedIndices.length < sampleSize) {
      const candidateIndex = Math.floor(this.nextUnitInterval() * populationSize);

      if (selectedIndices.includes(candidateIndex)) {
        continue;
      }

      selectedIndices.push(candidateIndex);
    }

    return selectedIndices;
  }
}

/** Creates a pseudo-random generator; uses `randomSeed` when provided. */
export function createRandomNumberGenerator(randomSeed?: number): DeterministicRandomNumberGenerator {
  const seed =
    randomSeed ?? (Math.floor(Math.random() * 0x100000000) >>> 0);

  return new DeterministicRandomNumberGenerator(seed);
}

/** Computes adaptive RANSAC iteration cap from observed inlier ratio. */
export function computeAdaptiveRansacIterationCount(
  observedInlierRatio: number,
  sampleSize: number,
  desiredConfidence: number,
  maximumIterations: number,
): number {
  if (observedInlierRatio <= 0) {
    return maximumIterations;
  }

  if (observedInlierRatio >= 1) {
    return 1;
  }

  const hypothesisSuccessProbability = Math.pow(observedInlierRatio, sampleSize);

  if (hypothesisSuccessProbability <= 0) {
    return maximumIterations;
  }

  const requiredIterations = Math.log(1 - desiredConfidence) / Math.log(1 - hypothesisSuccessProbability);
  const roundedIterations = Math.ceil(requiredIterations);

  if (!Number.isFinite(roundedIterations)) {
    return maximumIterations;
  }

  return Math.min(maximumIterations, Math.max(1, roundedIterations));
}
