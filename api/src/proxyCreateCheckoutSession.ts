import * as admin from "firebase-admin";
import Stripe from "stripe";
import { STRIPE_PRICE_IDS_BY_TIER, USE_MOCK_STRIPE } from "./_shared/pricing";
import type { UserTier } from "./_shared/tiers";
import { ApiError } from "./lib/apiError";

type PaidTier = Exclude<UserTier, "freemium">;

const VALID_TIERS: ReadonlySet<PaidTier> = new Set(["basic", "advanced", "designer"]);

export interface ProxyCreateCheckoutSessionInput {
  tier?: PaidTier;
  returnUrl?: string;
}

export interface ProxyCreateCheckoutSessionOutput {
  url: string;
  mock: boolean;
}

export async function handleProxyCreateCheckoutSession(
  uid: string,
  email: string | undefined,
  input: ProxyCreateCheckoutSessionInput,
): Promise<ProxyCreateCheckoutSessionOutput> {
  const { tier, returnUrl } = input || {};
  if (!tier || !VALID_TIERS.has(tier)) {
    throw new ApiError("invalid-argument", "tier must be 'basic', 'advanced', or 'designer'.");
  }

  const priceId = STRIPE_PRICE_IDS_BY_TIER[tier];

  if (USE_MOCK_STRIPE) {
    const base = returnUrl || "http://localhost:3000";
    const url =
      `${base}/__mock-checkout` +
      `?priceId=${encodeURIComponent(priceId)}` +
      `&uid=${encodeURIComponent(uid)}` +
      `&tier=${encodeURIComponent(tier)}`;
    return { url, mock: true };
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) throw new ApiError("internal", "STRIPE_SECRET_KEY not configured.");

  const stripe = new Stripe(stripeKey);
  const base = returnUrl || "http://localhost:3000";

  const userRef = admin.firestore().doc(`users/${uid}`);
  const snap = await userRef.get();
  const userData = snap.exists
    ? (snap.data() as { email?: string; stripeCustomerId?: string | null })
    : null;
  let customerId = userData?.stripeCustomerId ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userData?.email || email || undefined,
      metadata: { firebaseUid: uid },
    });
    customerId = customer.id;
    await userRef.update({ stripeCustomerId: customerId });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/?upgrade=success`,
      cancel_url: `${base}/?upgrade=canceled`,
      allow_promotion_codes: true,
      client_reference_id: uid,
      subscription_data: {
        metadata: { firebaseUid: uid },
      },
    });

    if (!session.url) {
      throw new ApiError("internal", "Stripe returned no checkout URL.");
    }

    return { url: session.url, mock: false };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    console.error(JSON.stringify({ severity: "ERROR", event: "stripe_checkout_create_failed", error: (e as Error).message }));
    throw new ApiError("internal", `Failed to create checkout session: ${(e as Error).message}`);
  }
}
