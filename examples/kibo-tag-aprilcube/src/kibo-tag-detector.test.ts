/**
 * Unit tests for kibo-tag detection conversion.
 */
import { describe, expect, it } from "vitest";
import { convertKiboTagDetectionsToMarkerCorners } from "./kibo-tag-detector.js";
import type { KiboTagDetection } from "./types.js";

describe("convertKiboTagDetectionsToMarkerCorners", () => {
  it("keeps configured marker IDs and converts corner coordinates", () => {
    const detections: KiboTagDetection[] = [
      {
        id: 4,
        decision_margin: 80,
        corners: [
          { x: 10, y: 20 },
          { x: 30, y: 20 },
          { x: 30, y: 40 },
          { x: 10, y: 40 },
        ],
      },
      {
        id: 99,
        decision_margin: 100,
        corners: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
      },
    ];

    const markerCorners = convertKiboTagDetectionsToMarkerCorners(
      detections,
      new Set([0, 1, 2, 3, 4, 5]),
      50,
    );

    expect(markerCorners).toHaveLength(1);
    expect(markerCorners[0]?.id).toBe(4);
    expect(markerCorners[0]?.corners).toEqual([
      [10, 20],
      [30, 20],
      [30, 40],
      [10, 40],
    ]);
  });

  it("filters detections below the decision margin threshold", () => {
    const detections: KiboTagDetection[] = [
      {
        id: 5,
        decision_margin: 10,
        corners: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
      },
    ];

    const markerCorners = convertKiboTagDetectionsToMarkerCorners(
      detections,
      new Set([0, 1, 2, 3, 4, 5]),
      50,
    );
    expect(markerCorners).toHaveLength(0);
  });

  it("filters detections outside configured tag IDs", () => {
    const detections: KiboTagDetection[] = [
      {
        id: 4,
        decision_margin: 80,
        corners: [
          { x: 10, y: 20 },
          { x: 30, y: 20 },
          { x: 30, y: 40 },
          { x: 10, y: 40 },
        ],
      },
    ];

    const markerCorners = convertKiboTagDetectionsToMarkerCorners(
      detections,
      new Set([24, 25]),
      50,
    );
    expect(markerCorners).toHaveLength(0);
  });
});
