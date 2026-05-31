/**
 * Frame capture and grayscale conversion from a started camera stream.
 */
export interface FrameCaptureResult {
  readonly imageData: ImageData;
  readonly grayscaleBuffer: Uint8Array;
  readonly captureWidth: number;
  readonly captureHeight: number;
}

/** Captures the current video frame into a canvas and grayscale buffer. */
export function captureVideoFrameToGrayscale(
  videoElement: HTMLVideoElement,
  captureCanvas: HTMLCanvasElement,
): FrameCaptureResult | null {
  const captureWidth = videoElement.videoWidth;
  const captureHeight = videoElement.videoHeight;

  if (captureWidth <= 0 || captureHeight <= 0) {
    return null;
  }

  captureCanvas.width = captureWidth;
  captureCanvas.height = captureHeight;

  const canvasContext = captureCanvas.getContext("2d", { willReadFrequently: true });

  if (canvasContext === null) {
    return null;
  }

  canvasContext.drawImage(videoElement, 0, 0, captureWidth, captureHeight);
  const imageData = canvasContext.getImageData(0, 0, captureWidth, captureHeight);
  const grayscaleBuffer = convertRgbaToGrayscale(imageData.data, captureWidth, captureHeight);

  return {
    imageData,
    grayscaleBuffer,
    captureWidth,
    captureHeight,
  };
}

/** Converts RGBA pixel data to a single-channel grayscale buffer. */
export function convertRgbaToGrayscale(
  rgbaPixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
): Uint8Array {
  const expectedPixelCount = imageWidth * imageHeight;
  const grayscaleBuffer = new Uint8Array(expectedPixelCount);

  for (
    let rgbaIndex = 0, grayscaleIndex = 0;
    rgbaIndex < rgbaPixels.length;
    rgbaIndex += 4, grayscaleIndex += 1
  ) {
    const red = rgbaPixels[rgbaIndex] ?? 0;
    const green = rgbaPixels[rgbaIndex + 1] ?? 0;
    const blue = rgbaPixels[rgbaIndex + 2] ?? 0;
    grayscaleBuffer[grayscaleIndex] = Math.round((red + green + blue) / 3);
  }

  return grayscaleBuffer;
}
