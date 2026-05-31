/**
 * Converts a loaded image element into a canvas grayscale buffer for kibo-tag detection.
 */
import { convertRgbaToGrayscale } from "./camera.js";

export interface ImageFileCaptureResult {
  readonly grayscaleBuffer: Uint8Array;
  readonly captureWidth: number;
  readonly captureHeight: number;
}

/** Draws an image file into a canvas and returns a grayscale detection buffer. */
export function captureImageElementToGrayscale(
  imageElement: HTMLImageElement,
  captureCanvas: HTMLCanvasElement,
): ImageFileCaptureResult | null {
  const captureWidth = imageElement.naturalWidth;
  const captureHeight = imageElement.naturalHeight;

  if (captureWidth <= 0 || captureHeight <= 0) {
    return null;
  }

  captureCanvas.width = captureWidth;
  captureCanvas.height = captureHeight;

  const canvasContext = captureCanvas.getContext("2d", { willReadFrequently: true });

  if (canvasContext === null) {
    return null;
  }

  canvasContext.drawImage(imageElement, 0, 0, captureWidth, captureHeight);
  const imageData = canvasContext.getImageData(0, 0, captureWidth, captureHeight);

  return {
    grayscaleBuffer: convertRgbaToGrayscale(imageData.data, captureWidth, captureHeight),
    captureWidth,
    captureHeight,
  };
}

/** Loads an image URL and resolves when pixels are ready for canvas capture. */
export function loadImageFromUrl(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const imageElement = new Image();
    imageElement.onload = () => {
      resolve(imageElement);
    };
    imageElement.onerror = () => {
      reject(new Error(`Failed to load image from ${imageUrl}.`));
    };
    imageElement.src = imageUrl;
  });
}
