/**
 * Vitest helpers for mocking CanvasRenderingContext2D in overlay contract tests.
 */
import { vi } from "vitest";

export interface MockCanvas2dContext {
  readonly canvasContext: CanvasRenderingContext2D;
  readonly drawImageMock: ReturnType<typeof vi.fn>;
}

/** Builds a minimal 2D canvas context mock with a spied drawImage. */
export function createMockCanvas2dContext(): MockCanvas2dContext {
  const drawImageMock = vi.fn();
  const canvasContext = {
    clearRect: vi.fn(),
    drawImage: drawImageMock,
    strokeStyle: "",
    lineWidth: 0,
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fillStyle: "",
    fillRect: vi.fn(),
  };

  return {
    canvasContext: canvasContext as unknown as CanvasRenderingContext2D,
    drawImageMock,
  };
}
