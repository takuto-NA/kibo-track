/**
 * Shared MediaStream lifecycle helpers for camera open/probe paths.
 */

/** Stops every track on a media stream. */
export function stopMediaStreamTracks(mediaStream: MediaStream): void {
  for (const track of mediaStream.getTracks()) {
    track.stop();
  }
}

/** Stops a camera stream when one is active. */
export function stopCameraStream(mediaStream: MediaStream | null): void {
  if (mediaStream === null) {
    return;
  }

  stopMediaStreamTracks(mediaStream);
}
