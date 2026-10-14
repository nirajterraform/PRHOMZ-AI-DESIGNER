import React, { useState } from 'react';

declare const __BUILD_ID__: string;

/**
 * Small corner badge showing which environment and which build you are looking at.
 *
 * It exists because the PWA service worker can serve a stale bundle after a
 * deploy, and we repeatedly spent test rounds judging "new" behaviour that was
 * actually the old bundle. The build id changes every build, so a glance confirms
 * whether the thing being tested is the thing that was deployed.
 *
 * Rendered ONLY when VITE_ENV_LABEL is set. Production does not set it, so this
 * is invisible there and promoting the code changes nothing visually on live.
 */
export const BuildBadge: React.FC = () => {
  const label = import.meta.env.VITE_ENV_LABEL as string | undefined;
  const [hidden, setHidden] = useState(false);

  if (!label || hidden) return null;

  const buildId = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'unknown';
  const version = (import.meta.env.VITE_APP_VERSION as string | undefined) || '';

  return (
    <div
      className="fixed bottom-3 left-3 z-[60] flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 backdrop-blur-md shadow-lg"
      title="Environment and build identifier. Click to dismiss for this session."
    >
      <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
        {label}
      </span>
      <span className="text-[10px] font-mono text-google-gray">
        build {buildId}
        {version ? ` · ${version}` : ''}
      </span>
      <button
        onClick={() => setHidden(true)}
        aria-label="Hide environment badge"
        className="ml-0.5 text-[10px] font-bold leading-none text-google-gray hover:text-google-dark"
      >
        ✕
      </button>
    </div>
  );
};
