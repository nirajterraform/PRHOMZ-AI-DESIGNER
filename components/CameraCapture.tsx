import React, { useEffect, useRef, useState } from 'react';
import { X, Camera as CameraIcon, RefreshCcw, AlertCircle } from 'lucide-react';

/**
 * In-app camera. Opens a live preview via getUserMedia and returns the captured
 * frame as a JPEG File — reliable in the browser AND an installed PWA, unlike the
 * flaky `<input capture>` OS hand-off. Falls back with a clear message (and points
 * the user at "Upload") when the camera is blocked/absent/busy.
 */
interface Props {
  onCapture: (file: File) => void;
  onClose: () => void;
}

type Facing = 'environment' | 'user';

export const CameraCapture: React.FC<Props> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<Facing>('environment');

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const start = async (mode: Facing) => {
    stop();
    setReady(false);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Request a consistent capture resolution so the saved photo size doesn't
        // jump around between portrait/landscape (the ideals are hints, not forced).
        video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setReady(true);
    } catch (err) {
      const name = (err as { name?: string })?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setError('Camera access is blocked. Allow camera for this site in your browser settings, then reopen — or use “Upload” instead.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') {
        setError('No camera was found on this device. Use “Upload” instead.');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setError('The camera is in use by another app. Close it and try again.');
      } else {
        setError('Could not start the camera. Use “Upload” instead.');
      }
    }
  };

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser does not support the in-app camera. Use “Upload” instead.');
      return;
    }
    start('environment');
    return stop;
    // Mount-only: switching cameras calls start() directly via flip().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // iOS Safari doesn't re-fit the <video> to its container after a device rotation
  // (portrait↔landscape), so the preview looks resized/misaligned. Nudge a reflow on
  // orientation/resize to keep it correctly sized. Android handles this natively.
  useEffect(() => {
    const refit = () => {
      const v = videoRef.current;
      if (!v) return;
      const prev = v.style.display;
      v.style.display = 'none';
      void v.offsetHeight; // force reflow
      v.style.display = prev;
    };
    window.addEventListener('orientationchange', refit);
    window.addEventListener('resize', refit);
    return () => {
      window.removeEventListener('orientationchange', refit);
      window.removeEventListener('resize', refit);
    };
  }, []);

  const flip = () => {
    const next: Facing = facing === 'environment' ? 'user' : 'environment';
    setFacing(next);
    start(next);
  };

  const shoot = () => {
    const video = videoRef.current;
    if (!video || !ready) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Mirror the front camera so the saved image matches the on-screen preview.
    if (facing === 'user') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `room-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        stop();
        onCapture(file);
        onClose();
      },
      'image/jpeg',
      0.92,
    );
  };

  const close = () => {
    stop();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 text-white">
        <button type="button" onClick={close} aria-label="Close camera" className="p-1">
          <X className="w-6 h-6" />
        </button>
        <span className="text-sm font-semibold">Take a photo of your room</span>
        <button type="button" onClick={flip} aria-label="Switch camera" disabled={!!error} className="p-1 disabled:opacity-30">
          <RefreshCcw className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="max-w-xs text-center px-6">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-white/90 leading-relaxed">{error}</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`w-full h-full object-contain ${facing === 'user' ? '-scale-x-100' : ''}`}
          />
        )}
      </div>

      <div className="p-6 flex items-center justify-center">
        {error ? (
          <button type="button" onClick={close} className="px-6 py-2.5 rounded-full bg-white text-black text-sm font-bold">
            Close
          </button>
        ) : (
          <button
            type="button"
            onClick={shoot}
            disabled={!ready}
            aria-label="Capture photo"
            className="w-16 h-16 rounded-full border-4 border-white bg-white/20 active:scale-95 transition-transform disabled:opacity-40 grid place-items-center"
          >
            <CameraIcon className="w-6 h-6 text-white" />
          </button>
        )}
      </div>
    </div>
  );
};
