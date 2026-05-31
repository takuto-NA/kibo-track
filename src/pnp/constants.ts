/**
 * Named constants for Levenberg-Marquardt pose refinement.
 */

/** Minimum correspondences required for public refinePoseLM. */
export const MINIMUM_REFINEMENT_CORRESPONDENCE_COUNT = 4;

/** Number of optimizer parameters: rotation vector plus translation. */
export const POSE_PARAMETER_COUNT = 6;

/** Residual penalty applied when a trial pose cannot project points. */
export const INVALID_PROJECTION_RESIDUAL_PENALTY_PX = 1000;

/** Epsilon for treating initial mean reprojection error as zero. */
export const ZERO_INITIAL_MEAN_ERROR_EPSILON_PX = 1e-12;

/** Default maximum LM iterations. */
export const DEFAULT_LM_MAX_ITERATIONS = 100;

/** Default numerical Jacobian step size. */
export const DEFAULT_LM_JACOBIAN_STEP = 1e-6;

/** Default LM gradient tolerance. */
export const DEFAULT_LM_TOLERANCE_GRADIENT = 1e-6;

/** Default LM step tolerance. */
export const DEFAULT_LM_TOLERANCE_STEP = 1e-6;

/** Default LM residual tolerance. */
export const DEFAULT_LM_TOLERANCE_RESIDUAL = 1e-6;

/** Default initial LM damping parameter. */
export const DEFAULT_LM_LAMBDA_INITIAL = 1e-3;
