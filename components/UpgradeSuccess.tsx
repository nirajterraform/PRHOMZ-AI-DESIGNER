import React, { useEffect, useState } from "react";
import { CheckCircle2, Crown, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "./Button";
import { TIER_DISPLAY } from "../shared/pricing";
import type { UserAccount, UserTier } from "../types";

interface UpgradeSuccessProps {
  user: UserAccount;
  onStartDesigning: () => void;
  onGoToGallery: () => void;
  onDismiss: () => void;
}

/**
 * Post-checkout landing screen. Subscribes to the user doc via the parent's
 * existing snapshot — does not refetch. If the parent passes a still-Freemium
 * user (race: redirect arrived before the webhook fired), shows a brief
 * "Finalizing your subscription" spinner and re-renders once the parent's
 * subscription delivers the updated doc.
 */
export const UpgradeSuccess: React.FC<UpgradeSuccessProps> = ({
  user,
  onStartDesigning,
  onGoToGallery,
  onDismiss,
}) => {
  const [waitedTooLong, setWaitedTooLong] = useState(false);

  // If the webhook hasn't landed within 10s, surface a fallback message so the
  // user isn't stuck at a perma-spinner. The most common cause is a
  // misconfigured emulator URL or webhook 4xx response.
  useEffect(() => {
    if (user.tier === "freemium") {
      const t = window.setTimeout(() => setWaitedTooLong(true), 10000);
      return () => window.clearTimeout(t);
    }
    setWaitedTooLong(false);
  }, [user.tier]);

  if (user.tier === "freemium") {
    return (
      <FullPage>
        <div className="bg-google-surface border border-google-border rounded-3xl shadow-2xl max-w-lg w-full p-10 text-center">
          <Loader2 size={36} className="mx-auto text-google-blue mb-4 animate-spin" />
          <h2 className="text-2xl font-bold text-google-dark mb-2">Finalizing your subscription…</h2>
          <p className="text-sm text-google-gray mb-6">
            We're confirming your payment with Stripe. This usually takes a couple of seconds.
          </p>
          {waitedTooLong && (
            <div className="text-left bg-orange-400/10 border border-orange-400/30 rounded-xl p-4 text-xs text-google-dark space-y-2">
              <p className="font-bold text-orange-400 uppercase tracking-widest">Still waiting?</p>
              <p>
                The webhook hasn't reached us yet. In dev mode, double-check that the emulator is running
                and that the MockCheckout's Succeed click returned 200. You can also dismiss this screen
                and your tier will update as soon as the event arrives.
              </p>
              <Button variant="secondary" onClick={onDismiss} className="rounded-xl text-xs">
                Continue to app
              </Button>
            </div>
          )}
        </div>
      </FullPage>
    );
  }

  const display = TIER_DISPLAY[user.tier as UserTier];

  return (
    <FullPage>
      <div className="bg-google-surface border border-google-border rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden">
        <div className="bg-google-blue/10 border-b border-google-blue/20 px-8 py-6 flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-google-blue/15 flex items-center justify-center text-google-blue">
            <CheckCircle2 size={28} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-google-blue uppercase tracking-[0.3em]">
              Subscription Active
            </p>
            <h1 className="text-3xl font-semibold text-google-dark mt-1">Welcome to {display.name}</h1>
          </div>
        </div>

        <div className="p-10 space-y-8">
          <p className="text-google-gray text-sm leading-relaxed">{display.tagline} Your new benefits are live now — no need to refresh.</p>

          <div className="bg-google-bg border border-google-border rounded-2xl p-6 space-y-3">
            <div className="flex items-center space-x-2 mb-2">
              <Crown size={16} className="text-google-blue" />
              <span className="text-[10px] font-bold text-google-blue uppercase tracking-[0.3em]">What you unlocked</span>
            </div>
            <ul className="space-y-2">
              {display.highlights.map((highlight) => (
                <li key={highlight} className="flex items-start space-x-3 text-sm text-google-dark">
                  <CheckCircle2 size={16} className="text-google-blue mt-0.5 flex-shrink-0" />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="primary"
              onClick={onStartDesigning}
              className="rounded-xl py-4 text-sm font-bold flex-1"
            >
              <Sparkles size={16} className="mr-2" /> Generate your first render
            </Button>
            <Button
              variant="secondary"
              onClick={onGoToGallery}
              className="rounded-xl py-4 text-sm font-bold flex-1"
            >
              Go to Gallery <ArrowRight size={16} className="ml-2" />
            </Button>
          </div>

          <p className="text-center text-[10px] font-bold text-google-gray uppercase tracking-[0.3em]">
            Manage your plan anytime from the Profile menu · Cancel anytime
          </p>
        </div>
      </div>
    </FullPage>
  );
};

const FullPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-google-bg text-google-dark flex items-center justify-center p-6">
    {children}
  </div>
);
