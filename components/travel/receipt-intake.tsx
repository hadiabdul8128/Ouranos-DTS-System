'use client';

import {useEffect, useRef, useState} from 'react';
import {Camera, ScanLine, Upload, X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {cameraError, captureReceiptPhoto, ReceiptCameraSession} from './receipt-camera';
import './receipt-intake.css';

export function ReceiptIntake({disabled = false, onFiles}: {disabled?: boolean; onFiles: (files: File[]) => void}) {
  const [open, setOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [session] = useState(() => new ReceiptCameraSession());
  const video = useRef<HTMLVideoElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const active = useRef(false);
  const restoreFocus = useRef(false);
  const generation = useRef(0);
  const captureInProgress = useRef(false);

  function close() {
    generation.current++;
    active.current = false;
    session.close();
    restoreFocus.current = true;
    setStream(null);
    setOpen(false);
    setReady(false);
  }

  async function start() {
    generation.current++;
    const requestGeneration = generation.current;
    active.current = true;
    setOpen(true);
    setReady(false);
    setStream(null);
    setError('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('Live camera capture requires HTTPS or localhost and a browser with camera support. You can upload a receipt instead.');
      return;
    }
    try {
      const next = await session.open(constraints => navigator.mediaDevices.getUserMedia(constraints));
      if (next && active.current && requestGeneration === generation.current) setStream(next);
    } catch (e) {
      if (active.current && requestGeneration === generation.current) setError(cameraError(e));
    }
  }

  useEffect(() => () => {active.current = false; session.close()}, [session]);
  useEffect(() => {
    if (open) closeButton.current?.focus();
    else if (restoreFocus.current) {restoreFocus.current = false; trigger.current?.focus()}
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const hide = () => {if (document.hidden) close()};
    const escape = (e: KeyboardEvent) => {if (e.key === 'Escape') {e.preventDefault(); close()}};
    document.addEventListener('visibilitychange', hide);
    document.addEventListener('keydown', escape);
    return () => {document.removeEventListener('visibilitychange', hide); document.removeEventListener('keydown', escape)};
  // The session and refs are stable; closing does not depend on rendering state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    const preview = video.current;
    if (!stream || !preview) return;
    let disposed = false;
    preview.srcObject = stream;
    const ended = () => {
      session.close();
      setReady(false);
      setStream(null);
      setError('The camera disconnected. Try again or upload a receipt.');
    };
    const tracks = stream.getVideoTracks();
    tracks.forEach(track => track.addEventListener('ended', ended));
    void preview.play().catch(() => {if (!disposed && active.current) setError('Unable to show the camera preview. Try again or upload a receipt.')});
    return () => {disposed = true; tracks.forEach(track => track.removeEventListener('ended', ended)); preview.srcObject = null};
  }, [stream, session]);
  useEffect(() => {if (disabled && active.current) close()}, [disabled]); // eslint-disable-line react-hooks/exhaustive-deps

  async function scan() {
    if (!video.current || !ready || disabled || captureInProgress.current) return;
    captureInProgress.current = true;
    const captureGeneration = generation.current;
    setCapturing(true);
    setError('');
    try {
      const photo = await captureReceiptPhoto(video.current, document.createElement('canvas'));
      if (!active.current || captureGeneration !== generation.current) return;
      close();
      onFiles([photo]);
    } catch (e) {
      if (active.current && captureGeneration === generation.current) setError(e instanceof Error ? e.message : 'Unable to capture this photo. Try again.');
    } finally {
      captureInProgress.current = false;
      setCapturing(false);
    }
  }

  return <>
    <div className="cw-section-heading cw-intake-heading">
      <h2>Receipts</h2>
      <div className="cw-intake-actions">
        <Button ref={trigger} type="button" variant="outline" disabled={disabled || open} onClick={() => void start()} aria-expanded={open}><Camera size={15}/> Take a photo</Button>
        <label className={`cw-upload-button ${disabled ? 'is-disabled' : ''}`}><Upload size={15}/> Upload receipt
          <input aria-label="Upload receipt" type="file" accept="image/jpeg,image/png,application/pdf" multiple disabled={disabled} onChange={e => {const files = Array.from(e.target.files || []); e.target.value = ''; if (files.length) {close(); onFiles(files)}}}/>
        </label>
      </div>
    </div>
    {open && <section className="cw-camera cw-card" aria-label="Receipt camera">
      <div className="cw-camera-heading"><h3>Photograph your receipt</h3><Button ref={closeButton} type="button" variant="ghost" onClick={close} aria-label="Close camera"><X size={18}/></Button></div>
      <p className="cw-muted">Hold the entire receipt steady in good light. Make sure the text is readable, then scan.</p>
      <div className="cw-camera-preview">
        <video ref={video} autoPlay playsInline muted aria-label="Live receipt camera preview" onLoadedData={() => setReady(true)} onPlaying={() => setReady(true)} onWaiting={() => setReady(false)}/>
        {!ready && !error && <p role="status">{stream ? 'Starting camera…' : 'Allow camera access in your browser to continue.'}</p>}
      </div>
      {error && <p className="cw-feedback cw-error" role="alert">{error}</p>}
      <div className="cw-camera-footer"><p className="cw-muted">The photo uses the same receipt scan and extraction as an upload. Check any uncertain details afterward.</p><div className="cw-intake-actions">
        {error && <Button type="button" variant="outline" disabled={capturing || disabled} onClick={() => void start()}>Try again</Button>}
        <Button type="button" disabled={!ready || capturing || disabled || !!error} onClick={() => void scan()}><ScanLine size={16}/>{capturing ? 'Capturing…' : 'Scan receipt'}</Button>
      </div></div>
    </section>}
  </>;
}
