import * as admin from "firebase-admin";
import Stripe from "stripe";
import { startOfNextMonthUTC } from "./_shared/tiers";
import { USE_MOCK_STRIPE } from "./_shared/pricing";
import { ApiError } from "./lib/apiError";

export interface OnSignupOutput {
  created: boolean;
  uid: string;
}

/**
 * Called by the frontend immediately after a successful sign-up (or first
 * sign-in if missing). Idempotent — if the user doc already exists, returns
 * created=false without clobbering.
 *
 * Replaces the v1 Firebase Auth `auth.user().onCreate` trigger from the
 * Cloud Functions era.
 */
export async function handleOnSignup(uid: string, email: string | undefined): Promise<OnSignupOutput> {
  if (!uid) throw new ApiError("invalid-argument", "uid required.");

  const ref = admin.firestore().doc(`users/${uid}`);
  const snap = await ref.get();
  if (snap.exists) {
    return { created: false, uid };
  }

  const safeEmail = email || "";
  const name = safeEmail.split("@")[0] || "User";
  const now = Date.now();

  let stripeCustomerId: string | null = null;
  if (!USE_MOCK_STRIPE) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      console.warn(
        JSON.stringify({ severity: "WARNING", event: "stripe_key_missing_at_signup", uid }),
      );
    } else {
      try {
        const stripe = new Stripe(stripeKey);
        const customer = await stripe.customers.create({
          email: safeEmail,
          metadata: { firebaseUid: uid },
        });
        stripeCustomerId = customer.id;
      } catch (e) {
        // Don't fail signup if Stripe is unreachable — upgrade path will retry.
        console.warn(
          JSON.stringify({
            severity: "WARNING",
            event: "stripe_customer_create_failed_at_signup",
            uid,
            error: (e as Error).message,
          }),
        );
      }
    }
  }

  await ref.set({
    id: uid,
    email: safeEmail,
    name,
    role: "Client",
    tier: "freemium",
    stripeCustomerId,
    subscriptionId: null,
    subscriptionStatus: null,
    currentPeriodEnd: null,
    renderTimestamps: [],
    totalRenders: 0,
    monthlyDesignCount: 0,
    monthlyResetAt: startOfNextMonthUTC(),
    createdAt: now,
    lastActive: now,
  });

  return { created: true, uid };
}
