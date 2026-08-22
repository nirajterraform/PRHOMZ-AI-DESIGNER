import React, { useEffect, useState } from 'react';
import { Download, X, Share, MoreVertical, PlusSquare } from 'lucide-react';

/**
 * Always-visible "Install app" affordance.
 *
 * Chrome/Edge/Android expose `beforeinstallprompt` → one-tap native install. But that
 * event is unreliable: Chrome throttles it after a dismissal, suppresses it once the
 * app has been installed, and sometimes just delays it. So we DON'T gate the button on
 * it — the pill always shows (except when already running standalone). On click:
 *   • native prompt available → fire it;
 *   • otherwise → show manual, per-browser "Add to Home Screen" steps.
 * This guarantees a discoverable install path everywhere.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true);

const isIos = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ reports as Mac; detect via touch.
    (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document)
  );
};

const isAndroid = (): boolean =>
  typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

export const PwaInstallButton: React.FC = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    () =>
      typeof window !== 'undefined'
        ? (window as unknown as { __deferredInstallPrompt?: BeforeInstallPromptEvent | null }).__deferredInstallPrompt ?? null
        : null,
  );
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onCaptured = () => {
      const g = window as unknown as { __deferredInstallPrompt?: BeforeInstallPromptEvent | null };
      if (g.__deferredInstallPrompt) setDeferred(g.__deferredInstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      (window as unknown as { __deferredInstallPrompt?: BeforeInstallPromptEvent | null }).__deferredInstallPrompt = null;
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('pwa-installable', onCaptured);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('pwa-installable', onCaptured);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || isStandalone()) return null;

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setDeferred(null);
      (window as unknown as { __deferredInstallPrompt?: BeforeInstallPromptEvent | null }).__deferredInstallPrompt = null;
      return;
    }
    // No native prompt available → show manual steps.
    setShowHelp(true);
  };

  const pill =
    'flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-google-blue text-google-bg text-xs font-bold hover:opacity-90 transition-opacity whitespace-nowrap';

  const ios = isIos();
  const android = isAndroid();

  return (
    <>
      <button type="button" onClick={handleClick} className={pill} aria-label="Install PRHOMZ AI Designer app">
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Install app</span>
        <span className="sm:hidden">Install</span>
      </button>

      {showHelp && (
        <div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 p-4"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full max-w-sm bg-google-surface border border-google-border rounded-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-bold text-google-dark">Install PRHOMZ AI Designer</h3>
              <button type="button" onClick={() => setShowHelp(false)} aria-label="Close" className="text-google-gray hover:text-google-dark">
                <X className="w-4 h-4" />
              </button>
            </div>

            {ios ? (
              <>
                <p className="text-xs text-google-gray/80 mb-3 leading-relaxed">
                  On iPhone, apps are added manually from <span className="font-semibold text-google-dark">Safari</span>. Follow these steps (these are instructions, not buttons):
                </p>
                <ol className="space-y-2.5 text-sm text-google-gray">
                  <li className="flex items-center gap-2">
                    1. Tap the <Share className="inline w-4 h-4 text-google-blue" /> <span className="font-semibold text-google-dark">Share</span> icon at the bottom of Safari
                  </li>
                  <li className="flex items-center gap-2">
                    2. Scroll down and choose <PlusSquare className="inline w-4 h-4 text-google-blue" /> <span className="font-semibold text-google-dark">Add to Home Screen</span>
                  </li>
                  <li>3. Tap <span className="font-semibold text-google-dark">Add</span> — the app lands on your home screen</li>
                </ol>
                <p className="text-google-gray/70 text-xs pt-3 leading-relaxed">
                  Not in Safari? Open this page in <span className="font-semibold text-google-dark">Safari</span> first — other iPhone browsers can't add to the Home Screen reliably.
                </p>
              </>
            ) : android ? (
              <ol className="space-y-2.5 text-sm text-google-gray">
                <li className="flex items-center gap-2">
                  1. Tap the <MoreVertical className="inline w-4 h-4 text-google-blue" /> <span className="font-semibold text-google-dark">menu</span> (top-right in Chrome)
                </li>
                <li>
                  2. Tap <span className="font-semibold text-google-dark">Install app</span> — or <span className="font-semibold text-google-dark">Add to Home screen</span>
                </li>
                <li>3. Confirm <span className="font-semibold text-google-dark">Install</span></li>
                <li className="text-google-gray/70 text-xs pt-1">Already installed? Open it from your home screen / app drawer.</li>
              </ol>
            ) : (
              <ol className="space-y-2.5 text-sm text-google-gray">
                <li className="flex items-center gap-2">
                  1. Click the <Download className="inline w-4 h-4 text-google-blue" /> <span className="font-semibold text-google-dark">install icon</span> in the address bar
                </li>
                <li>
                  2. Or open the <MoreVertical className="inline w-4 h-4 text-google-blue" /> <span className="font-semibold text-google-dark">menu</span> → <span className="font-semibold text-google-dark">Cast, save, and share</span> → <span className="font-semibold text-google-dark">Install</span>
                </li>
                <li>3. Confirm <span className="font-semibold text-google-dark">Install</span></li>
              </ol>
            )}
          </div>
        </div>
      )}
    </>
  );
};
