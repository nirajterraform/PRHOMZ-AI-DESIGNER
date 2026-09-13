import type { UserTier } from "./tiers";

/**
 * Stripe Price IDs by tier. The defaults are the LIVE IDs from the PRHOMZ
 * production Stripe business account (acct_1Tbvze…), each a recurring monthly
 * subscription in USD (Basic $9.99 / Advanced $19.99 / Designer $49.99).
 *
 * Staging overrides these via STRIPE_PRICE_{BASIC,ADVANCED,DESIGNER} env vars,
 * set on the Cloud Run services by Terraform, because it bills against a
 * separate Stripe test sandbox with its own price IDs.
 *
 * These must stay env-driven rather than branch-specific constants: staging is
 * promoted to prod by merging `staging` -> `main`, so hardcoding the sandbox IDs
 * on the staging branch would ship test prices into production on the next merge.
 * Prod sets none of these vars and keeps the defaults below.
 *
 * Read via `process.env` guarded by a `typeof process` check — this module is
 * also imported by the browser bundle (for TIER_DISPLAY/TIER_ORDER), where
 * `process` does not exist. Only server code reads the price IDs themselves.
 */
function priceId(envVar: string, liveDefault: string): string {
  if (typeof process !== "undefined" && process.env && process.env[envVar]) {
    return process.env[envVar] as string;
  }
  return liveDefault;
}

export const STRIPE_PRICE_IDS_BY_TIER: Record<Exclude<UserTier, "freemium">, string> = {
  basic: priceId("STRIPE_PRICE_BASIC", "price_1TnWBKHQLSQMVgM3PKmSmLeF"),
  advanced: priceId("STRIPE_PRICE_ADVANCED", "price_1TnWF9HQLSQMVgM3YuGscFOh"),
  designer: priceId("STRIPE_PRICE_DESIGNER", "price_1TnWGKHQLSQMVgM3jQHfgGDS"),
};

/**
 * Flip to `true` to bypass Stripe entirely and run the Day 2 mock-checkout
 * flow. Useful for CI E2E tests or for offline development. When `false`,
 * Functions call the real Stripe SDK and the client redirects to real
 * Checkout / Customer Portal URLs.
 */
export const USE_MOCK_STRIPE = false;

/**
 * Reverse lookup: maps a Stripe Price ID back to our internal tier. Used by
 * the webhook handler when a subscription event arrives so we know which tier
 * to assign on the user doc.
 */
export function getTierFromPriceId(priceId: string): Exclude<UserTier, "freemium"> | null {
  for (const [tier, id] of Object.entries(STRIPE_PRICE_IDS_BY_TIER) as Array<
    [Exclude<UserTier, "freemium">, string]
  >) {
    if (id === priceId) return tier;
  }
  return null;
}

export interface TierDisplay {
  tier: UserTier;
  name: string;
  pricePerMonth: number;
  tagline: string;
  monthlyRenders: number | "unlimited";
  dailyRenders: number | "unlimited";
  retentionDays: number;
  watermarked: boolean;
  highlights: string[];
}

export const TIER_DISPLAY: Record<UserTier, TierDisplay> = {
  freemium: {
    tier: "freemium",
    name: "Freemium",
    pricePerMonth: 0,
    tagline: "Try the engine. No card required.",
    monthlyRenders: 30,
    dailyRenders: "unlimited",
    retentionDays: 1,
    watermarked: true,
    highlights: [
      "PRHOMZ AI-powered Design Assistant",
      "Shop the Look furniture sourcing",
      "30 renders per month",
      "Unlimited renders per day",
      "24-hour gallery retention",
      "Watermarked downloads",
    ],
  },
  basic: {
    tier: "basic",
    name: "Basic",
    pricePerMonth: 9.99,
    tagline: "For everyday remodels and small projects.",
    monthlyRenders: 100,
    dailyRenders: "unlimited",
    retentionDays: 7,
    watermarked: false,
    highlights: [
      "PRHOMZ AI-powered Design Assistant",
      "Shop the Look furniture sourcing",
      "100 renders per month",
      "Unlimited renders per day",
      "7-day gallery retention",
      "No watermark",
    ],
  },
  advanced: {
    tier: "advanced",
    name: "Advanced",
    pricePerMonth: 19.99,
    tagline: "Unlimited daily renders for active stylists.",
    monthlyRenders: 300,
    dailyRenders: "unlimited",
    retentionDays: 15,
    watermarked: false,
    highlights: [
      "PRHOMZ AI-powered Design Assistant",
      "Shop the Look furniture sourcing",
      "300 renders per month",
      "Unlimited daily renders",
      "15-day gallery retention",
      "No watermark",
    ],
  },
  designer: {
    tier: "designer",
    name: "Designer",
    pricePerMonth: 49.99,
    tagline: "Unlimited everything for design professionals.",
    monthlyRenders: "unlimited",
    dailyRenders: "unlimited",
    retentionDays: 30,
    watermarked: false,
    highlights: [
      "PRHOMZ AI-powered Design Assistant",
      "Shop the Look furniture sourcing",
      "Unlimited monthly renders",
      "Unlimited daily renders",
      "30-day gallery retention",
      "No watermark",
    ],
  },
};

export const PAID_TIERS: ReadonlyArray<Exclude<UserTier, "freemium">> = [
  "basic",
  "advanced",
  "designer",
];

export const TIER_ORDER: ReadonlyArray<UserTier> = [
  "freemium",
  "basic",
  "advanced",
  "designer",
];

/**
 * Returns -1 if `a` is a lower tier than `b`, 0 if equal, 1 if higher.
 * Used by the pricing page to decide between "Upgrade", "Downgrade", and
 * "Your Plan" CTAs.
 */
export function compareTiers(a: UserTier, b: UserTier): number {
  return TIER_ORDER.indexOf(a) - TIER_ORDER.indexOf(b);
}
