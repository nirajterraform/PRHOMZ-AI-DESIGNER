import React, { useState } from "react";
import { CreditCard, Lock, CheckCircle2, AlertTriangle, ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "./Button";
import { TIER_DISPLAY } from "../shared/pricing";
import { fireMockWebhookEvent } from "../services/stripeService";
import type { UserTier } from "../types";

/**
 * Emulator-only "fake Stripe Checkout" page. Reached by browser redirect from
 * `proxyCreateCheckoutSession`. The Succeed button POSTs a synthetic
 * `customer.subscription.created` event to the local `stripeWebhook`. The
 * Fail/Cancel button returns to the pricing page without writing anything.
 *
 * NOT reachable in production builds — `App.tsx` guards the route with
 * `import.meta.env.DEV`.
 */
export const MockCheckout: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const tier = params.get("tier") as UserTier | null;
  const uid = params.get("uid");
  const priceId = params.get("priceId");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!tier || !uid || !priceId || tier === "freemium") {
    return (
      <FullPage>
        <div className="bg-google-surface border border-red-400/40 rounded-3xl p-10 max-w-lg text-center">
          <AlertTriangle size={36} className="mx-auto text-red-400 mb-4" />
          <h2 className="text-2xl font-bold text-google-dark mb-2">Invalid Checkout Request</h2>
          <p className="text-sm text-google-gray mb-6">
            The checkout URL is missing required parameters. This page should only be reached by
            redirect from the Pricing page.
          </p>
          <Button onClick={() => (window.location.href = "/")}>Back to App</Button>
        </div>
      </FullPage>
    );
  }

  const display = TIER_DISPLAY[tier];

  const handleSucceed = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const now = Date.now();
      const periodEnd = now + 30 * 24 * 60 * 60 * 1000;
      await fireMockWebhookEvent({
        type: "customer.subscription.created",
        data: {
          uid,
          tier,
          subscriptionId: `mock_sub_${Math.random().toString(36).slice(2, 10)}`,
          currentPeriodEnd: periodEnd,
        },
      });
      window.location.href = "/?upgrade=success";
    } catch (e) {
      setError((e as Error).message || "Failed to fire mock webhook.");
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    window.location.href = "/";
  };

  return (
    <FullPage>
      <div className="bg-google-surface border border-google-border rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Header bar — mimics Stripe Checkout's header */}
        <div className="bg-google-bg/60 border-b border-google-border px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck size={16} className="text-google-blue" />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-google-blue">
              MOCK CHECKOUT (Track A)
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-google-gray">
            DEV ONLY · NO REAL CHARGE
          </span>
        </div>

        <div className="p-10 space-y-8">
          <div>
            <p className="text-[10px] font-bold text-google-gray uppercase tracking-[0.3em] mb-2">
              You are subscribing to
            </p>
            <h1 className="text-3xl font-semibold text-google-dark">{display.name}</h1>
            <p className="text-sm text-google-gray mt-2">{display.tagline}</p>
          </div>

          <div className="bg-google-bg border border-google-border rounded-2xl p-6 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-bold text-google-gray uppercase tracking-widest">Plan</span>
              <span className="text-sm font-bold text-google-dark">{display.name} · Monthly</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-bold text-google-gray uppercase tracking-widest">Price</span>
              <span className="text-2xl font-black text-google-dark">${display.pricePerMonth.toFixed(2)}<span className="text-sm font-bold text-google-gray uppercase tracking-widest"> / mo</span></span>
            </div>
            <div className="pt-3 mt-3 border-t border-google-border">
              <p className="text-[10px] font-bold text-google-gray uppercase tracking-widest mb-1">Price ID</p>
              <p className="text-xs font-mono text-google-dark">{priceId}</p>
            </div>
          </div>

          {/* Fake card form — purely visual */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-google-gray">
              <CreditCard size={14} />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Card information (visual only)</span>
            </div>
            <input
              type="text"
              defaultValue="4242 4242 4242 4242"
              disabled
              className="w-full bg-google-bg border border-google-border rounded-xl px-4 py-3 text-sm text-google-dark font-mono"
            />
            <div className="grid grid-cols-2 gap-3">
              <input type="text" defaultValue="12 / 34" disabled className="bg-google-bg border border-google-border rounded-xl px-4 py-3 text-sm text-google-dark font-mono" />
              <input type="text" defaultValue="123" disabled className="bg-google-bg border border-google-border rounded-xl px-4 py-3 text-sm text-google-dark font-mono" />
            </div>
            <p className="text-[10px] font-medium text-google-gray flex items-center space-x-1">
              <Lock size={10} /> <span>No real card is processed — this is a mock page.</span>
            </p>
          </div>

          {error && (
            <div className="bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-3 text-sm text-red-400 flex items-start space-x-2">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={handleCancel}
              disabled={submitting}
              className="rounded-xl py-4 text-sm font-bold flex-1"
            >
              <ArrowLeft size={16} className="mr-2" /> Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSucceed}
              isLoading={submitting}
              className="rounded-xl py-4 text-sm font-bold flex-2 sm:flex-1"
            >
              <CheckCircle2 size={16} className="mr-2" /> Subscribe — Succeed
            </Button>
          </div>
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
