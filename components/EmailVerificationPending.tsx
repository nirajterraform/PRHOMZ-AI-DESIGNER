import React, { useEffect, useRef, useState } from "react";
import { Mail, RefreshCcw, LogOut, CheckCircle2 } from "lucide-react";
import { Button } from "./Button";
import { auth } from "../services/firebaseClient";
import { resendVerification, signOut } from "../services/authService";

interface EmailVerificationPendingProps {
  email: string;
}

const RESEND_COOLDOWN_SECONDS = 60;
const POLL_INTERVAL_MS = 5000;

export const EmailVerificationPending: React.FC<EmailVerificationPendingProps> = ({ email }) => {
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const cooldownRef = useRef<number | null>(null);

  useEffect(() => {
    pollRef.current = window.setInterval(async () => {
      if (auth.currentUser && !auth.currentUser.emailVerified) {
        try {
          await auth.currentUser.reload();
          // Once Firebase confirms verification, force-refresh the ID token so
          // its email_verified claim updates. Without this the cached token
          // still says false and the backend keeps rejecting requests.
          if (auth.currentUser.emailVerified) {
            await auth.currentUser.getIdToken(true);
            // reload()/getIdToken() update auth.currentUser in place but do NOT
            // fire onAuthStateChanged, so the app's auth subscription never sees
            // emailVerified flip to true and the user stays stuck on this screen
            // until a manual refresh. Reload the page so the subscription
            // re-initialises with the now-verified user and logs them straight in.
            window.location.reload();
          }
        } catch {
          // ignore transient reload errors
        }
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      if (cooldownRef.current) window.clearInterval(cooldownRef.current);
    };
  }, []);

  const startCooldown = () => {
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    cooldownRef.current = window.setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          if (cooldownRef.current) window.clearInterval(cooldownRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setError(null);
    setFeedback(null);
    try {
      await resendVerification();
      setFeedback("Verification email sent. Check your inbox.");
      startCooldown();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resend verification.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-google-bg flex items-center justify-center overflow-hidden font-sans">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-google-blue/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative w-full max-w-lg px-6 animate-fade">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-serif italic tracking-tighter text-google-dark mb-3">
            PRHOMZ <span className="text-google-blue not-italic font-sans font-black">AI</span>
          </h1>
          <p className="text-google-gray text-xs font-bold uppercase tracking-[0.4em] opacity-80">
            Verify your email to continue
          </p>
        </div>

        <div className="bg-google-surface border border-google-border rounded-[2.5rem] p-10 md:p-12 shadow-2xl backdrop-blur-2xl space-y-8">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-3xl bg-google-blue/10 border border-google-blue/20 flex items-center justify-center text-google-blue">
              <Mail size={36} />
            </div>
          </div>

          <div className="text-center space-y-3">
            <h2 className="text-2xl font-bold text-google-dark">Check your inbox</h2>
            <p className="text-sm text-google-gray leading-relaxed">
              We sent a verification link to
            </p>
            <p className="text-base font-bold text-google-dark break-all">{email}</p>
            <p className="text-xs text-google-gray leading-relaxed pt-2">
              Click the link in the email to activate your account. This page will refresh automatically.
            </p>
          </div>

          {feedback && (
            <div className="bg-google-blue/10 border border-google-blue/20 rounded-xl px-4 py-3 flex items-center space-x-2 text-google-blue text-xs font-bold uppercase tracking-widest">
              <CheckCircle2 size={16} />
              <span>{feedback}</span>
            </div>
          )}

          {error && (
            <div className="bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-3 text-red-400 text-xs font-bold uppercase tracking-widest">
              {error}
            </div>
          )}

          <div className="space-y-3 pt-2">
            <Button
              onClick={handleResend}
              isLoading={isResending}
              disabled={resendCooldown > 0 || isResending}
              className="w-full py-4 rounded-2xl text-sm"
            >
              <RefreshCcw size={16} className="mr-2" />
              {resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : "Resend verification email"}
            </Button>

            <button
              type="button"
              onClick={() => signOut()}
              className="w-full py-3 text-xs font-black uppercase tracking-[0.2em] text-google-gray hover:text-google-dark transition-colors flex items-center justify-center"
            >
              <LogOut size={14} className="mr-2" />
              Sign out and try a different email
            </button>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-google-gray font-bold uppercase tracking-[0.2em] opacity-40">
          PRHOMZ Inc • Secure passwordless verification
        </p>
      </div>
    </div>
  );
};
