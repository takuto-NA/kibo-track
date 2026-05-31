/**
 * Named constants for the kibo-tag AprilCube browser example.
 */

/** Maximum attempts to capture a non-empty first video frame. */
export const FIRST_FRAME_CAPTURE_MAX_ATTEMPTS = 30;

/** Delay between first-frame capture attempts in milliseconds. */
export const FIRST_FRAME_CAPTURE_RETRY_DELAY_MILLISECONDS = 50;

/** Timeout waiting for video metadata after attaching a camera stream. */
export const VIDEO_METADATA_TIMEOUT_MILLISECONDS = 10_000;

/** Minimum decision margin from kibo-tag before accepting a detection. */
export const MINIMUM_TAG_DECISION_MARGIN = 50;

/** Configured AprilCube marker IDs for the example cube. */
export const APRILCUBE_MARKER_IDS = [0, 1, 2, 3, 4, 5] as const;

/** Path to the kibo-tag Web Worker script relative to the site root. */
export const KIBO_TAG_WORKER_SCRIPT_PATH = "/vendor/kibo-tag/apriltag.js";

/** Path to the kibo-tag Emscripten WASM bundle loaded by the worker via importScripts. */
export const KIBO_TAG_WASM_MODULE_PATH = "/vendor/kibo-tag/apriltag_wasm.js";

/** kibo-tag ArUco dictionary name for DICT_4X4_100. */
export const KIBO_TAG_ARUCO_FAMILY_NAME = "DICT_4X4_100";

/** bitsCorrected recommended for live ArUco scenes in kibo-tag. */
export const KIBO_TAG_ARUCO_BITS_CORRECTED = 0;

/** Reference camera intrinsics resolution width in pixels. */
export const INTRINSICS_REFERENCE_WIDTH_PIXELS = 1280;

/** Reference camera intrinsics resolution height in pixels. */
export const INTRINSICS_REFERENCE_HEIGHT_PIXELS = 720;

/** Placeholder focal length in pixels at the reference resolution. */
export const PLACEHOLDER_FOCAL_LENGTH_PIXELS = 900;

/** Placeholder principal point X at the reference resolution. */
export const PLACEHOLDER_PRINCIPAL_POINT_X_PIXELS = 640;

/** Placeholder principal point Y at the reference resolution. */
export const PLACEHOLDER_PRINCIPAL_POINT_Y_PIXELS = 360;

/** Target camera frame rate when the 30 fps option is selected. */
export const CAMERA_FRAME_RATE_30_FPS = 30;

/** Target camera frame rate when the 60 fps option is selected. */
export const CAMERA_FRAME_RATE_60_FPS = 60;

/** Common fps values offered when they fall within the probed device capability range. */
export const CAMERA_FRAME_RATE_CANDIDATE_VALUES = [
  15,
  24,
  CAMERA_FRAME_RATE_30_FPS,
  48,
  CAMERA_FRAME_RATE_60_FPS,
] as const;

/** Cube wireframe edge color. */
export const CUBE_WIREFRAME_STROKE_COLOR = "#00ff88";

/** Cube wireframe stroke width in pixels. */
export const CUBE_WIREFRAME_STROKE_WIDTH_PX = 4;

/** Pose axis stroke width in pixels. */
export const POSE_AXIS_STROKE_WIDTH_PX = 3;

/** Marker outline stroke width in pixels. */
export const MARKER_OUTLINE_STROKE_WIDTH_PX = 2;

/** Viewport background when the camera feed is hidden. */
export const WIREFRAME_ONLY_VIEWPORT_BACKGROUND_COLOR = "#000000";

/** Marker outline stroke color. */
export const MARKER_OUTLINE_STROKE_COLOR = "#ffcc00";

/** Axis colors for overlay drawing. */
export const AXIS_X_COLOR = "#ff4444";
export const AXIS_Y_COLOR = "#44ff44";
export const AXIS_Z_COLOR = "#4488ff";

/** Axis length in cube units for overlay drawing. */
export const AXIS_LENGTH_CUBE_UNITS = 0.05;
