/**
 * Parses UI and query-string corner order values into AprilCubeCornerOrderName.
 */
import type { CornerOrderSelection } from "./types.js";

const CORNER_ORDER_SELECTION_VALUES: readonly CornerOrderSelection[] = [
  "canonical",
  "clockwiseRotate90",
  "clockwiseRotate180",
  "clockwiseRotate270",
  "reverse",
  "reversedCanonical",
];

/** Default corner order used by kibo-tag detections in this example. */
export const DEFAULT_CORNER_ORDER_SELECTION: CornerOrderSelection = "reversedCanonical";

function isCornerOrderSelection(value: string): value is CornerOrderSelection {
  return CORNER_ORDER_SELECTION_VALUES.some((candidate) => candidate === value);
}

/** Reads corner order from a select element value. */
export function readCornerOrderFromSelectValue(selectValue: string): CornerOrderSelection {
  if (isCornerOrderSelection(selectValue)) {
    return selectValue;
  }

  return DEFAULT_CORNER_ORDER_SELECTION;
}

/** Reads corner order from an optional query-string value. */
export function readCornerOrderFromQueryValue(
  queryValue: string | null,
): CornerOrderSelection {
  if (queryValue === null || queryValue.trim().length === 0) {
    return DEFAULT_CORNER_ORDER_SELECTION;
  }

  if (isCornerOrderSelection(queryValue)) {
    return queryValue;
  }

  return DEFAULT_CORNER_ORDER_SELECTION;
}
