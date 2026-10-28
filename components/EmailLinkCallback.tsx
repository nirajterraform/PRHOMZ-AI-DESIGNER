import React, { useEffect, useState } from 'react';
import { Mail, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import {
  completeEmailLinkSignIn,
  getPendingSignInEmail,
  validateEmailFormat,
} from '../services/authService';

/**
 * Landing screen for an incoming passwordless sign-in link.
 *
 * Firebase will not complete an email-link sign-in without the address the link
 * was issued for — it is deliberately absent from the URL, so that someone who
 * intercepts the link cannot use it on its own. When the link is opened in the
 * same browser that requested it we have the address in localStorage and this
 * screen is a brief spinner. Opened elsewhere (clicked on a phone, requested on
 * a laptop), it asks for the address instead of failing.
 *
 * Consent is not collected here: it was recorded server-side when the link was
 * requested, keyed to the address.
 */

type State =
  | { kind: 'working' }
  | { kind: 'needEmail'; message?: string }
  | { kind: 'failed'; message: string };

function describeLinkError(err: unknown): string {
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  if (msg.includes('invalid-action-code') || msg.includes('expired-action-code')) {
    return 'This sign-in link has expired or has already been used. Links are single-use — please request a new one.';
  }
  if (msg.includes('invalid-email')) {
    return 'That email address does not match the one this link was sent to.';
  }
  if (msg.includes('user-disabled')) {
    return 'This account has been disabled. Please contact support.';
  }
  if (msg.includes('network-request-failed')) {
    return 'Network error. Check your connection and try the link again.';
  }
  return 'We could not complete the sign-in. Please request a new link.';
}

export const EmailLinkCallback: React.FC<{
  onComplete: () => void;
  onGiveUp: () => void;
}> = ({ onComplete, onGiveUp }) => {
  const [state, setState] = useState<State>({ kind: 'working' });
  const [email, setEmail] = useState('');

  const complete = async (address: string) => {
    setState({ kind: 'working' });
    try {
      await completeEmailLinkSignIn(address);
      // The address bar was already cleared when the link was captured, so
      // there is nothing to tidy here. Hand back to App explicitly — doing it
      // on an auth-state change instead would race a restored session on the
      // same page load.
      onComplete();
    } catch (err) {
      const message = describeLinkError(err);
      // A wrong address is recoverable — ask again rather than dead-ending.
      const wrongEmail =
        err instanceof Error && err.message.toLowerCase().includes('invalid-email');
      setState(wrongEmail ? { kind: 'needEmail', message } : { kind: 'failed', message });
    }
  };

  useEffect(() => {
    const stored = getPendingSignInEmail();
    if (stored) {
      void complete(stored);
    } else {
      setState({ kind: 'needEmail' });
    }
    // Runs once for the link in the current URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-google-bg overflow-y-auto font-sans">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-google-blue/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative min-h-full flex items-center justify-center py-10 px-6">
        <div className="w-full max-w-md animate-fade">
          <div className="text-center mb-10">
            <h1 className="text-2xl md:text-3xl font-display italic font-medium uppercase tracking-wide text-google-dark whitespace-nowrap">
              PRHOMZ{' '}
              <span className="text-google-blue not-italic font-sans font-black tracking-tight">
                AI DESIGNER
              </span>
            </h1>
          </div>

          <div className="bg-google-surface border border-google-border rounded-[2.5rem] p-10 shadow-2xl backdrop-blur-2xl">
            {state.kind === 'working' && (
              <div className="space-y-6 text-center">
                <div className="flex justify-center">
                  <div className="w-14 h-14 rounded-2xl bg-google-blue/10 border border-google-blue/20 flex items-center justify-center text-google-blue animate-pulse">
                    <Mail size={26} />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-google-dark">Signing you in…</h2>
                <p className="text-sm text-google-gray">This takes a moment.</p>
              </div>
            )}

            {state.kind === 'needEmail' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formatError = validateEmailFormat(email);
                  if (formatError) {
                    setState({ kind: 'needEmail', message: formatError });
                    return;
                  }
                  void complete(email);
                }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-google-dark">Confirm your email</h2>
                  <p className="text-sm text-google-gray leading-relaxed">
                    You opened this link on a different device or browser than the one
                    you requested it from. Enter the email address the link was sent to.
                  </p>
                </div>

                <div className="relative group/input">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-google-gray group-focus-within/input:text-google-blue transition-colors">
                    <Mail size={20} />
                  </div>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                    className="w-full bg-google-bg border border-google-border rounded-2xl py-4 pl-14 pr-6 text-base focus:ring-2 focus:ring-google-blue focus:outline-none focus:border-google-blue transition-all text-google-dark placeholder-google-gray shadow-inner"
                  />
                </div>

                {state.message && (
                  <div className="bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-3 text-red-400 text-xs font-bold uppercase tracking-widest">
                    {state.message}
                  </div>
                )}

                <Button type="submit" className="w-full py-4 rounded-2xl text-base shadow-xl" disabled={!email}>
                  Continue <ArrowRight size={18} className="ml-2" />
                </Button>
              </form>
            )}

            {state.kind === 'failed' && (
              <div className="space-y-6">
                <div className="flex justify-center">
                  <div className="w-14 h-14 rounded-2xl bg-red-400/10 border border-red-400/30 flex items-center justify-center text-red-400">
                    <AlertTriangle size={26} />
                  </div>
                </div>
                <div className="space-y-2 text-center">
                  <h2 className="text-xl font-bold text-google-dark">Sign-in link didn't work</h2>
                  <p className="text-sm text-google-gray leading-relaxed">{state.message}</p>
                </div>
                <Button
                  onClick={onGiveUp}
                  className="w-full py-4 rounded-2xl text-base shadow-xl"
                >
                  Request a New Link
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
