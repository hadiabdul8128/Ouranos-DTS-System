import 'fake-indexeddb/auto';
import {describe, expect, it, vi} from 'vitest';
import {cameraError, captureReceiptPhoto, ReceiptCameraSession} from '../../components/travel/receipt-camera';
import {OuranosDatabase} from '../../packages/offline/database';
import {LocalRepository} from '../../packages/offline/repository';

function stream() {
  const stop = vi.fn();
  return {value: {getTracks: () => [{stop}]} as unknown as MediaStream, stop};
}
function frame(blob: Blob | null = new Blob(['photo'], {type: 'image/jpeg'})) {
  const drawImage = vi.fn();
  const toBlob = vi.fn((cb: BlobCallback) => cb(blob));
  const canvas = {width: 0, height: 0, getContext: () => ({drawImage}), toBlob} as unknown as HTMLCanvasElement;
  const video = {readyState: 2, videoWidth: 1920, videoHeight: 1080} as HTMLVideoElement;
  return {canvas, video, drawImage, toBlob};
}

describe('live receipt camera', () => {
  it('requests high-resolution video, prefers the rear camera, and never requests a microphone', async () => {
    const session = new ReceiptCameraSession(), camera = stream();
    const request = vi.fn(async () => camera.value);
    expect(await session.open(request)).toBe(camera.value);
    expect(request).toHaveBeenCalledWith({audio: false, video: {facingMode: {ideal: 'environment'}, width: {ideal: 1920}, height: {ideal: 1080}}});
    session.close();
    session.close();
    expect(camera.stop).toHaveBeenCalledTimes(1);
  });
  it('stops a stream granted after the user has closed the camera', async () => {
    const session = new ReceiptCameraSession(), camera = stream();
    let resolve!: (value: MediaStream) => void;
    const opening = session.open(() => new Promise<MediaStream>(r => {resolve = r}));
    session.close();
    resolve(camera.value);
    expect(await opening).toBeNull();
    expect(camera.stop).toHaveBeenCalledTimes(1);
  });
  it('stops an older permission response without closing the newer camera', async () => {
    const session = new ReceiptCameraSession(), old = stream(), current = stream();
    let resolve!: (value: MediaStream) => void;
    const opening = session.open(() => new Promise<MediaStream>(r => {resolve = r}));
    await session.open(async () => current.value);
    resolve(old.value);
    expect(await opening).toBeNull();
    expect(old.stop).toHaveBeenCalledTimes(1);
    expect(current.stop).not.toHaveBeenCalled();
    session.close();
    expect(current.stop).toHaveBeenCalledTimes(1);
  });
  it('releases the current camera before opening another', async () => {
    const session = new ReceiptCameraSession(), first = stream(), second = stream();
    await session.open(async () => first.value);
    await session.open(async () => {expect(first.stop).toHaveBeenCalledTimes(1); return second.value});
    session.close();
    expect(second.stop).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['NotAllowedError', 'Allow camera access'],
    ['SecurityError', 'Allow camera access'],
    ['NotFoundError', 'No camera'],
    ['NotReadableError', 'another app'],
  ])('explains %s with an upload fallback', (name, expected) => {
    expect(cameraError({name})).toContain(expected);
    expect(cameraError({name})).toContain('upload');
  });
  it('captures the full-resolution frame as a named JPEG accepted by the receipt pipeline', async () => {
    const {canvas, video, drawImage, toBlob} = frame();
    const photo = await captureReceiptPhoto(video, canvas);
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1920, 1080);
    expect(canvas.width).toBe(1920);
    expect(canvas.height).toBe(1080);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', .95);
    expect(photo.type).toBe('image/jpeg');
    expect(photo.name).toMatch(/^receipt-.*\.jpg$/);
    expect(await photo.text()).toBe('photo');
    const db = new OuranosDatabase(crypto.randomUUID());
    try {
      const tripId = crypto.randomUUID();
      const id = await new LocalRepository(db, crypto.randomUUID()).captureReceipt(tripId, photo);
      expect((await db.entities.get(`document:${id}`))?.local.data).toMatchObject({tripId, filename: photo.name, mediaType: 'image/jpeg', byteSize: photo.size});
      expect((await db.outbox.toArray())[0].command.type).toBe('document.register');
      expect((await db.files.get(id))?.state).toBe('pending');
    } finally {await db.delete()}
  });
  it('refuses a frame before the camera is ready', async () => {
    const {canvas, video, drawImage} = frame();
    await expect(captureReceiptPhoto({...video, readyState: 1} as HTMLVideoElement, canvas)).rejects.toThrow('not ready');
    await expect(captureReceiptPhoto({...video, videoWidth: 0} as HTMLVideoElement, canvas)).rejects.toThrow('not ready');
    expect(drawImage).not.toHaveBeenCalled();
  });
  it('does not queue an empty or failed photo', async () => {
    const {canvas, video} = frame(null);
    await expect(captureReceiptPhoto(video, canvas)).rejects.toThrow('Unable to capture');
    await expect(captureReceiptPhoto(video, {...canvas, getContext: () => null} as HTMLCanvasElement)).rejects.toThrow('Unable to capture');
    const empty = frame(new Blob([], {type: 'image/jpeg'}));
    await expect(captureReceiptPhoto(empty.video, empty.canvas)).rejects.toThrow('Unable to capture');
  });
  it('rejects unsupported image encodings and photos over the receipt upload limit', async () => {
    const png = frame(new Blob(['png'], {type: 'image/png'}));
    await expect(captureReceiptPhoto(png.video, png.canvas)).rejects.toThrow('Unable to capture');
    const huge = frame(new Blob([new Uint8Array(20 * 1024 * 1024 + 1)], {type: 'image/jpeg'}));
    await expect(captureReceiptPhoto(huge.video, huge.canvas)).rejects.toThrow('too large');
  });
});
