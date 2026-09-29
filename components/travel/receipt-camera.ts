/** Keep camera ownership outside React so late permission responses can be closed safely. */
export class ReceiptCameraSession {
  private generation = 0;
  private stream?: MediaStream;

  async open(getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>) {
    this.close();
    const generation = this.generation;
    const stream = await getUserMedia({
      audio: false,
      video: {facingMode: {ideal: 'environment'}, width: {ideal: 1920}, height: {ideal: 1080}},
    });
    if (generation !== this.generation) {
      stream.getTracks().forEach(track => track.stop());
      return null;
    }
    this.stream = stream;
    return stream;
  }

  close() {
    this.generation++;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = undefined;
  }
}

export function cameraError(error: unknown) {
  const name = error && typeof error === 'object' && 'name' in error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera access was blocked. Allow camera access in your browser settings, then try again. You can also upload a receipt.';
  if (name === 'NotFoundError') return 'No camera was found. Connect a webcam or upload a receipt instead.';
  if (name === 'NotReadableError') return 'Your camera is unavailable or in use by another app. Close that app and try again, or upload a receipt.';
  return 'Unable to open the camera. Try again or upload a receipt instead.';
}

export async function captureReceiptPhoto(video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<File> {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    throw new Error('The camera is not ready. Wait for the live picture, then try again.');
  }
  // Use the actual frame dimensions, not the smaller on-screen preview.
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to capture this photo. Upload a receipt instead.');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .95));
  if (!blob || !blob.size || blob.type !== 'image/jpeg') throw new Error('Unable to capture this photo. Please try again.');
  if (blob.size > 20 * 1024 * 1024) throw new Error('This photo is too large. Upload an image under 20 MB instead.');
  return new File([blob], `receipt-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`, {type: 'image/jpeg'});
}
