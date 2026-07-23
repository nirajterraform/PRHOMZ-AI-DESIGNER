import React, { useState } from "react";
import { Check, Crown, Sparkles, Star, Zap, ShieldCheck, AlertTriangle } from "lucide-react";
import { UserTier } from "../types";
import { TIER_DISPLAY, TIER_ORDER, compareTiers } from "../shared/pricing";
import { Button } from "./Button";
import { createCheckoutSession, createCustomerPortalSession } from "../services/stripeService";

interface PricingProps {
  currentTier: UserTier;
  subscriptionStatus?: "active" | "past_due" | "canceled" | null;
}

const TIER_ICON: Record<UserTier, React.FC<{ size?: number; className?: string }>> = {
  freemium: ShieldCheck,
  basic: Sparkles,
  advanced: Zap,
  designer: Crown,
};

const RECOMMENDED_TIER: UserTier = "advanced";

export const Pricing: React.FC<PricingProps> = ({ currentTier, subscriptionStatus }) => {
  const [loadingTier, setLoadingTier] = useState<UserTier | null>(null);
  const [error, setError] = useState<{ tier: UserTier; message: string } | null>(null);

  async function handleUpgrade(tier: Exclude<UserTier, "freemium">) {
    // Open Stripe Checkout in a new tab so the app stays open behind it.
    // Blank tab opened synchronously (within the click) to dodge popup blockers.
    const checkoutTab = window.open("", "_blank");
    setLoadingTier(tier);
    setError(null);
    try {
      const url = await createCheckoutSession(tier);
      if (checkoutTab) checkoutTab.location.href = url;
      else window.location.href = url; // fallback if the popup was blocked
      setLoadingTier(null);
    } catch (e) {
      if (checkoutTab) checkoutTab.close();
      const message = (e as { message?: string })?.message || "Failed to start checkout.";
      setError({ tier, message });
      setLoadingTier(null);
    }
  }

  async function handleManageSubscription() {
    // Open the Customer Portal in a new tab so the app stays open behind it.
    // Blank tab opened synchronously (within the click) to dodge popup blockers.
    const portalTab = window.open("", "_blank");
    setLoadingTier(currentTier);
    setError(null);
    try {
      const url = await createCustomerPortalSession();
      if (portalTab) portalTab.location.href = url;
      else window.location.href = url; // fallback if the popup was blocked
      setLoadingTier(null);
    } catch (e) {
      if (portalTab) portalTab.close();
      const message = (e as { message?: string })?.message || "Failed to open customer portal.";
      setError({ tier: currentTier, message });
      setLoadingTier(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto animate-fade">
      <header className="mb-16 text-center">
        <div className="inline-flex items-center space-x-2 mb-4 text-google-blue">
          <Crown size={16} />
          <span className="text-base font-bold uppercase tracking-[0.3em]">PRHOMZ AI Membership</span>
        </div>
        <h2 className="text-4xl md:text-5xl font-semibold text-google-dark mb-4">
          Choose your studio tier
        </h2>
        <p className="text-google-gray font-medium text-base max-w-2xl mx-auto leading-relaxed">
          Every tier unlocks the same engine. Higher tiers give you more renders, longer gallery
          retention, and an unwatermarked download. Cancel anytime from the Customer Portal.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {TIER_ORDER.map((tier) => {
          const display = TIER_DISPLAY[tier];
          const isCurrent = tier === currentTier;
          const isRecommended = tier === RECOMMENDED_TIER;
          const cmp = compareTiers(tier, currentTier);
          const TierIcon = TIER_ICON[tier];
          const isLoading = loadingTier === tier;
          const tierError = error?.tier === tier ? error.message : null;

          // Paid-tier users route ALL tier switches through Customer Portal —
          // Checkout creates a *new* subscription, which would duplicate billing
          // for someone who already has one. Portal lets Stripe handle the
          // upgrade/downgrade/proration server-side. Only Freemium users start
          // their first subscription via Checkout.
          const hasActiveSubscription = currentTier !== "freemium";

          let ctaLabel = "Upgrade";
          if (isCurrent) {
            ctaLabel = tier === "freemium" ? "Current Plan" : "Manage Subscription";
          } else if (cmp < 0) {
            ctaLabel = tier === "freemium" ? "Downgrade to Freemium" : "Change Plan";
          } else if (hasActiveSubscription) {
            ctaLabel = "Change Plan";
          }

          const isFreemiumCurrent = isCurrent && tier === "freemium";

          const handleClick = () => {
            if (isFreemiumCurrent) return;
            if (isCurrent) return handleManageSubscription();
            if (hasActiveSubscription) return handleManageSubscription();
            // Freemium user clicking a paid tier → fresh Checkout.
            return handleUpgrade(tier as Exclude<UserTier, "freemium">);
          };

          const buttonDisabled = isFreemiumCurrent || isLoading || loadingTier !== null;

          return (
            <div
              key={tier}
              className={`
                relative bg-google-surface border rounded-3xl p-8 flex flex-col transition-all
                ${isCurrent
                  ? "border-google-blue shadow-[0_0_30px_rgba(138,180,248,0.15)]"
                  : isRecommended
                    ? "border-google-blue/40 shadow-lg"
                    : "border-google-border hover:border-google-blue/30"}
              `}
            >
              {isRecommended && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="bg-google-blue text-google-bg px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center space-x-1 shadow-lg">
                    <Star size={10} fill="currentColor" />
                    <span>Most popular</span>
                  </div>
                </div>
              )}

              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="bg-google-dark text-google-bg px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg">
                    Your plan
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-3 mb-6">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                    isCurrent
                      ? "bg-google-blue/10 border-google-blue/30 text-google-blue"
                      : "bg-google-bg border-google-border text-google-gray"
                  }`}
                >
                  <TierIcon size={22} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-google-dark leading-none">{display.name}</h3>
                  <p className="text-[10px] font-bold text-google-gray uppercase tracking-widest mt-1">
                    {display.tagline}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline space-x-1">
                  <span className="text-5xl font-black text-google-dark">
                    ${display.pricePerMonth.toFixed(display.pricePerMonth === 0 ? 0 : 2)}
                  </span>
                  {display.pricePerMonth > 0 && (
                    <span className="text-sm font-bold text-google-gray uppercase tracking-widest">/ mo</span>
                  )}
                </div>
                {display.pricePerMonth === 0 && (
                  <p className="text-xs text-google-gray font-medium mt-1">Permanent free tier. No card.</p>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {display.highlights.map((highlight) => {
                  // Emphasize the render-quota lines (monthly/daily) so the
                  // difference between tiers is easy to compare at a glance.
                  const l = highlight.toLowerCase();
                  const isRenderMetric =
                    l.includes("render") &&
                    (l.includes("month") || l.includes("day") || l.includes("daily"));
                  return (
                    <li
                      key={highlight}
                      className={`flex items-start space-x-3 ${
                        isRenderMetric ? "-mx-2 px-2 py-1 rounded-lg bg-google-blue/[0.07]" : ""
                      }`}
                    >
                      <div
                        className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isRenderMetric || isCurrent
                            ? "bg-google-blue/15 text-google-blue"
                            : "bg-google-bg text-google-gray"
                        }`}
                      >
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <span
                        className={`text-sm leading-relaxed ${
                          isRenderMetric ? "text-google-blue font-bold" : "text-google-dark"
                        }`}
                      >
                        {highlight}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <Button
                onClick={handleClick}
                disabled={buttonDisabled}
                isLoading={isLoading}
                variant={isCurrent || isRecommended ? "primary" : "secondary"}
                className={`w-full rounded-xl py-4 text-sm font-bold ${
                  isFreemiumCurrent ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                {ctaLabel}
              </Button>

              {tierError && (
                <div className="mt-3 bg-red-400/10 border border-red-400/30 rounded-lg px-3 py-2 text-[11px] text-red-400 flex items-start space-x-2">
                  <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                  <span className="leading-snug">{tierError}</span>
                </div>
              )}

              {isCurrent && subscriptionStatus === "past_due" && !tierError && (
                <p className="mt-3 text-center text-xs font-bold uppercase tracking-widest text-orange-400">
                  Payment past due — update card
                </p>
              )}
              {isCurrent && subscriptionStatus === "canceled" && !tierError && (
                <p className="mt-3 text-center text-xs font-bold uppercase tracking-widest text-google-gray">
                  Subscription ending soon
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-12 text-center text-xs font-bold text-google-gray uppercase tracking-[0.3em]">
        Secured by Stripe · Cancel anytime · No long-term contracts
      </p>
    </div>
  );
};
