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

/** Minimum correspondences required for estimatePose and EPnP. */
export const MINIMUM_ESTIMATE_POSE_CORRESPONDENCE_COUNT = 4;

/** Distance below which two object points are treated as duplicates. */
export const DUPLICATE_POINT_DISTANCE_EPSILON = 1e-9;

/** Smallest/middle eigenvalue ratio treated as collinear geometry. */
export const COLLINEARITY_RANK_TOLERANCE = 1e-6;

/** Smallest eigenvalue ratio treated as coplanar geometry for v0.3 EPnP. */
export const COPLANARITY_RANK_TOLERANCE = 1e-4;

/** Default RANSAC maximum iteration count. */
export const DEFAULT_RANSAC_MAX_ITERATIONS = 100;

/** Default inlier reprojection threshold in pixel space. */
export const DEFAULT_RANSAC_REPROJECTION_ERROR_THRESHOLD_PX = 5;

/** Default desired RANSAC success confidence (not a probability guarantee). */
export const DEFAULT_RANSAC_DESIRED_CONFIDENCE = 0.99;

/** Default minimum inlier count required to accept a RANSAC model. */
export const DEFAULT_RANSAC_MINIMUM_INLIER_COUNT = 4;

/** Minimal correspondence sample size for EPnP RANSAC hypotheses. */
export const RANSAC_MINIMAL_SAMPLE_SIZE = 4;

/** Gauss-Newton iterations used inside EPnP beta refinement. */
export const EPNP_GAUSS_NEWTON_ITERATION_COUNT = 5;

/** Minimum camera-space depth treated as valid chirality. */
export const MINIMUM_CAMERA_SPACE_DEPTH = 1e-6;

/** Minimum inlier count required for non-zero confidence. */
export const CONFIDENCE_MINIMUM_INLIER_COUNT = 4;

/** Reprojection error multiplier for rejecting weak RANSAC refined models. */
export const RANSAC_REFINED_MODEL_ERROR_MULTIPLIER = 2;

/** Weight applied to inlier coverage in heuristic confidence. */
export const CONFIDENCE_INLIER_COVERAGE_WEIGHT = 0.5;

/** Weight applied to reprojection quality in heuristic confidence. */
export const CONFIDENCE_REPROJECTION_QUALITY_WEIGHT = 0.35;

/** Weight applied to minimum inlier count in heuristic confidence. */
export const CONFIDENCE_MINIMUM_INLIER_WEIGHT = 0.15;

/** Reprojection error scale that drives confidence toward zero when exceeded. */
export const CONFIDENCE_MAXIMUM_REPROJECTION_ERROR_PX = 20;
