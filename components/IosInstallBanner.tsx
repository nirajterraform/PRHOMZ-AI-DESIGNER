import React, { useEffect, useState } from 'react';
import { Share, X, ChevronDown, PlusSquare } from 'lucide-react';

/**
 * Guided "Add to Home Screen" banner for iPhone/iPad Safari.
 *
 * iOS has no programmatic install (Apple restriction), so we can't offer Android's
 * one-tap button. This auto-surfaces a friendly, dismissible banner that points at
 * Safari's Share button and spells out the 2-step flow — turning a confusing hunt
 * into an obvious action. Shows only on iOS Safari, only when not already installed,
 * and remembers dismissal so it never nags.
 */
const DISMISS_KEY = 'pwa-ios-banner-dismissed';

const isStandalone = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true);

const isIosSafari = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS =
    /iphone|ipad|ipod/i.test(ua) ||
    (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);
  const nonSafari = /crios|fxios|edgios|opt\//i.test(ua); // Chrome/FF/Edge/Opera on iOS
  return iOS && !nonSafari;
};

export const IosInstallBanner: React.FC = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isStandalone() || !isIosSafari()) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      /* private mode — ignore */
    }
    if (dismissed) return;
    const t = window.setTimeout(() => setShow(true), 1200);
    return () => window.clearTimeout(t);
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[115] px-4 pointer-events-none">
      <div className="mx-auto max-w-sm mb-4 pointer-events-auto animate-fade">
        <div className="bg-google-surface border border-google-border rounded-2xl shadow-2xl p-4">
          <div className="flex items-start gap-3">
            <img src="/favicon-192.png" alt="" className="w-10 h-10 rounded-xl bg-white p-0.5 flex-none" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-google-dark leading-tight">Install PRHOMZ AI Designer</p>
              <p className="text-xs text-google-gray mt-0.5 leading-relaxed">
                Add it to your Home Screen for a full-screen, app-like experience.
              </p>
            </div>
            <button onClick={dismiss} aria-label="Dismiss" className="text-google-gray hover:text-google-dark flex-none">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-xs text-google-dark bg-google-bg rounded-xl py-2.5 px-3">
            <span>Tap</span>
            <Share className="w-4 h-4 text-google-blue" />
            <span className="font-semibold">Share</span>
            <span>below, then</span>
            <PlusSquare className="w-4 h-4 text-google-blue" />
            <span className="font-semibold">Add to Home Screen</span>
          </div>
        </div>
        {/* Pointer down to Safari's Share button in the bottom toolbar. */}
        <div className="flex justify-center">
          <ChevronDown className="w-7 h-7 text-google-blue animate-bounce" />
        </div>
      </div>
    </div>
  );
};
