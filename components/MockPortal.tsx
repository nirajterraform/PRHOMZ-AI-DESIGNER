import React, { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, Ban, AlertTriangle, ArrowLeft, ShieldCheck, CheckCircle2, Crown } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "../services/firebaseClient";
import { Button } from "./Button";
import { TIER_DISPLAY, TIER_ORDER } from "../shared/pricing";
import { fireMockWebhookEvent } from "../services/stripeService";
import type { UserAccount, UserTier } from "../types";

/**
 * Emulator-only "fake Customer Portal". Lets the operator simulate every
 * subscription state transition without going through Stripe. Each button
 * POSTs the relevant synthetic event to the local `stripeWebhook`.
 *
 * NOT reachable in production builds — `App.tsx` guards the route with
 * `import.meta.env.DEV`.
 */
export const MockPortal: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const uid = params.get("uid");

  const [user, setUser] = useState<UserAccount | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setLoadError("Missing uid parameter.");
      return;
    }
    void refresh();
  }, [uid]);

  async function refresh() {
    if (!uid) return;
    try {
      const snap = await getDoc(doc(firestore, "users", uid));
      if (!snap.exists()) {
        setLoadError("User doc not found.");
        return;
      }
      setUser(snap.data() as UserAccount);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }

  if (!uid || loadError) {
    return (
      <FullPage>
        <div className="bg-google-surface border border-red-400/40 rounded-3xl p-10 max-w-lg text-center">
          <AlertTriangle size={36} className="mx-auto text-red-400 mb-4" />
          <h2 className="text-2xl font-bold text-google-dark mb-2">Can't load Portal</h2>
          <p className="text-sm text-google-gray mb-6">{loadError || "Missing uid parameter."}</p>
          <Button onClick={() => (window.location.href = "/")}>Back to App</Button>
        </div>
      </FullPage>
    );
  }

  if (!user) {
    return (
      <FullPage>
        <div className="text-google-gray text-sm">Loading subscription…</div>
      </FullPage>
    );
  }

  const tier = user.tier;
  const display = TIER_DISPLAY[tier];
  const tierIndex = TIER_ORDER.indexOf(tier);
  const upgradeTo = tierIndex < TIER_ORDER.length - 1 ? TIER_ORDER[tierIndex + 1] : null;
  const downgradeTo = tierIndex > 0 ? TIER_ORDER[tierIndex - 1] : null;

  async function fire(action: string, payload: () => Promise<void>) {
    setSubmitting(action);
    setLastAction(null);
    try {
      await payload();
      setLastAction(action);
      await refresh();
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setSubmitting(null);
    }
  }

  const handleUpgrade = () =>
    upgradeTo &&
    fire("upgrade", async () => {
      if (upgradeTo === "freemium") return;
      const now = Date.now();
      await fireMockWebhookEvent({
        type: "customer.subscription.updated",
        data: {
          uid,
          tier: upgradeTo,
          subscriptionId: user.subscriptionId || `mock_sub_${Math.random().toString(36).slice(2, 10)}`,
          currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
          cancelAtPeriodEnd: false,
        },
      });
    });

  const handleDowngrade = () =>
    downgradeTo &&
    fire("downgrade", async () => {
      if (downgradeTo === "freemium") {
        // Treat downgrade-to-freemium as a cancel-at-period-end.
        const now = Date.now();
        await fireMockWebhookEvent({
          type: "customer.subscription.deleted",
          data: { uid, subscriptionId: user.subscriptionId || "mock_sub_unknown" },
        });
        return;
      }
      const now = Date.now();
      await fireMockWebhookEvent({
        type: "customer.subscription.updated",
        data: {
          uid,
          tier: downgradeTo,
          subscriptionId: user.subscriptionId || `mock_sub_${Math.random().toString(36).slice(2, 10)}`,
          currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
          cancelAtPeriodEnd: false,
        },
      });
    });

  const handleCancel = () =>
    fire("cancel", async () => {
      await fireMockWebhookEvent({
        type: "customer.subscription.deleted",
        data: { uid, subscriptionId: user.subscriptionId || "mock_sub_unknown" },
      });
    });

  const handlePaymentFail = () =>
    fire("payment_fail", async () => {
      await fireMockWebhookEvent({
        type: "invoice.payment_failed",
        data: { uid, subscriptionId: user.subscriptionId || "mock_sub_unknown" },
      });
    });

  return (
    <FullPage>
      <div className="bg-google-surface border border-google-border rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden">
        <div className="bg-google-bg/60 border-b border-google-border px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck size={16} className="text-google-blue" />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-google-blue">
              MOCK CUSTOMER PORTAL (Track A)
            </span>
          </div>
          <Button variant="ghost" onClick={() => (window.location.href = "/")} className="text-xs">
            <ArrowLeft size={14} className="mr-1" /> Back to App
          </Button>
        </div>

        <div className="p-10 space-y-8">
          <header>
            <p className="text-[10px] font-bold text-google-gray uppercase tracking-[0.3em] mb-2">
              Current subscription
            </p>
            <div className="flex items-center space-x-3 mb-3">
              <Crown size={22} className="text-google-blue" />
              <h1 className="text-3xl font-semibold text-google-dark">{display.name}</h1>
            </div>
            <p className="text-sm text-google-gray">{display.tagline}</p>
          </header>

          <div className="grid grid-cols-2 gap-4">
            <Stat label="Status" value={user.subscriptionStatus ?? "(none)"} />
            <Stat label="Tier" value={tier} />
            <Stat
              label="Period ends"
              value={user.currentPeriodEnd ? new Date(user.currentPeriodEnd).toLocaleDateString() : "(none)"}
            />
            <Stat label="Subscription ID" value={user.subscriptionId ?? "(none)"} mono />
          </div>

          {lastAction && (
            <div className="bg-green-400/10 border border-green-400/30 rounded-xl px-4 py-3 text-sm text-google-dark flex items-center space-x-2">
              <CheckCircle2 size={16} className="text-green-400" />
              <span>
                Fired <code className="font-mono text-google-blue">{lastAction}</code> event. User doc refreshed below.
              </span>
            </div>
          )}

          <div className="space-y-3">
            <p className="text-[10px] font-bold text-google-gray uppercase tracking-[0.3em]">Test actions</p>

            <button
              disabled={!upgradeTo || submitting !== null}
              onClick={handleUpgrade}
              className="w-full bg-google-bg border border-google-border hover:border-google-blue rounded-2xl px-6 py-4 flex items-center justify-between transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="flex items-center space-x-3 text-left">
                <ArrowUp size={18} className="text-google-blue" />
                <div>
                  <p className="text-sm font-bold text-google-dark">Upgrade</p>
                  <p className="text-xs text-google-gray">
                    {upgradeTo ? `Promote to ${TIER_DISPLAY[upgradeTo].name}` : "Already on highest tier"}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-google-blue uppercase tracking-widest">
                {submitting === "upgrade" ? "Firing…" : "Run"}
              </span>
            </button>

            <button
              disabled={!downgradeTo || submitting !== null}
              onClick={handleDowngrade}
              className="w-full bg-google-bg border border-google-border hover:border-google-blue rounded-2xl px-6 py-4 flex items-center justify-between transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="flex items-center space-x-3 text-left">
                <ArrowDown size={18} className="text-google-blue" />
                <div>
                  <p className="text-sm font-bold text-google-dark">Downgrade</p>
                  <p className="text-xs text-google-gray">
                    {downgradeTo ? `Drop to ${TIER_DISPLAY[downgradeTo].name}` : "Already on lowest tier"}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-google-blue uppercase tracking-widest">
                {submitting === "downgrade" ? "Firing…" : "Run"}
              </span>
            </button>

            <button
              disabled={tier === "freemium" || submitting !== null}
              onClick={handleCancel}
              className="w-full bg-google-bg border border-google-border hover:border-red-400/50 rounded-2xl px-6 py-4 flex items-center justify-between transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="flex items-center space-x-3 text-left">
                <Ban size={18} className="text-red-400" />
                <div>
                  <p className="text-sm font-bold text-google-dark">Cancel subscription</p>
                  <p className="text-xs text-google-gray">Fires `customer.subscription.deleted` immediately (mock).</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
                {submitting === "cancel" ? "Firing…" : "Run"}
              </span>
            </button>

            <button
              disabled={tier === "freemium" || submitting !== null}
              onClick={handlePaymentFail}
              className="w-full bg-google-bg border border-google-border hover:border-orange-400/50 rounded-2xl px-6 py-4 flex items-center justify-between transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="flex items-center space-x-3 text-left">
                <AlertTriangle size={18} className="text-orange-400" />
                <div>
                  <p className="text-sm font-bold text-google-dark">Simulate payment failure</p>
                  <p className="text-xs text-google-gray">Sets `subscriptionStatus: 'past_due'`. No tier change.</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">
                {submitting === "payment_fail" ? "Firing…" : "Run"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </FullPage>
  );
};

const Stat: React.FC<{ label: string; value: string | UserTier; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="bg-google-bg border border-google-border rounded-xl p-4">
    <p className="text-[10px] font-bold text-google-gray uppercase tracking-[0.3em] mb-1">{label}</p>
    <p className={`text-sm text-google-dark ${mono ? "font-mono break-all" : "font-bold"}`}>{value}</p>
  </div>
);

const FullPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-google-bg text-google-dark flex items-center justify-center p-6">
    {children}
  </div>
);
