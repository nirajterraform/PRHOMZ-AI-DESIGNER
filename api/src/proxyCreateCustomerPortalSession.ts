import * as admin from "firebase-admin";
import Stripe from "stripe";
import { USE_MOCK_STRIPE } from "./_shared/pricing";
import { ApiError } from "./lib/apiError";

export interface ProxyCreateCustomerPortalSessionInput {
  returnUrl?: string;
}

export interface ProxyCreateCustomerPortalSessionOutput {
  url: string;
  mock: boolean;
}

export async function handleProxyCreateCustomerPortalSession(
  uid: string,
  input: ProxyCreateCustomerPortalSessionInput,
): Promise<ProxyCreateCustomerPortalSessionOutput> {
  const { returnUrl } = input || {};
  const base = returnUrl || "http://localhost:3000";

  if (USE_MOCK_STRIPE) {
    const url = `${base}/__mock-portal?uid=${encodeURIComponent(uid)}`;
    return { url, mock: true };
  }

  const userRef = admin.firestore().doc(`users/${uid}`);
  const snap = await userRef.get();
  const userData = snap.exists
    ? (snap.data() as { stripeCustomerId?: string | null })
    : null;
  const customerId = userData?.stripeCustomerId;

  if (!customerId) {
    throw new ApiError(
      "failed-precondition",
      "No Stripe customer is linked to this account. Start a subscription first.",
    );
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) throw new ApiError("internal", "STRIPE_SECRET_KEY not configured.");

  const stripe = new Stripe(stripeKey);

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: base,
    });
    return { url: session.url, mock: false };
  } catch (e) {
    console.error(JSON.stringify({ severity: "ERROR", event: "stripe_portal_create_failed", error: (e as Error).message }));
    throw new ApiError("internal", `Failed to open portal: ${(e as Error).message}`);
  }
}
