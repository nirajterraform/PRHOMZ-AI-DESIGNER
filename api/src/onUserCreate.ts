import * as admin from "firebase-admin";
import Stripe from "stripe";
import { startOfNextMonthUTC } from "./_shared/tiers";
import { USE_MOCK_STRIPE } from "./_shared/pricing";
import { validateSignupProfile, type SignupProfile } from "./_shared/profile";
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
 * `profile` carries the mandatory signup fields (first name, last name, gender, age range,
 * zip, country). It's validated server-side against the shared rules — never
 * trust the client. On first-sign-in fallback (no profile), the doc is still
 * created with best-effort defaults so the user isn't locked out.
 *
 * Replaces the v1 Firebase Auth `auth.user().onCreate` trigger from the
 * Cloud Functions era.
 */
export async function handleOnSignup(
  uid: string,
  email: string | undefined,
  profile?: Partial<SignupProfile>,
): Promise<OnSignupOutput> {
  if (!uid) throw new ApiError("invalid-argument", "uid required.");

  const ref = admin.firestore().doc(`users/${uid}`);
  const snap = await ref.get();
  if (snap.exists) {
    return { created: false, uid };
  }

  const safeEmail = email || "";
  const now = Date.now();

  // Validate the profile when supplied. A missing profile is tolerated only for
  // the legacy first-sign-in bootstrap path; a supplied-but-invalid profile is
  // rejected so bad data never reaches Firestore.
  let profileFields: SignupProfile | null = null;
  if (profile !== undefined) {
    const profileError = validateSignupProfile(profile);
    if (profileError) throw new ApiError("invalid-argument", profileError);
    profileFields = {
      firstName: profile.firstName!.trim(),
      lastName: profile.lastName!.trim(),
      gender: profile.gender!,
      ageRange: profile.ageRange!,
      zipCode: profile.zipCode!.trim(),
      country: profile.country!,
    };
  }

  // Display name: "First Last" from the signup profile when present, else
  // derived from email.
  const name = profileFields
    ? `${profileFields.firstName} ${profileFields.lastName}`.trim()
    : safeEmail.split("@")[0] || "User";

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
    // Profile captured at signup (null on the legacy first-sign-in path).
    firstName: profileFields?.firstName ?? null,
    lastName: profileFields?.lastName ?? null,
    gender: profileFields?.gender ?? null,
    ageRange: profileFields?.ageRange ?? null,
    zipCode: profileFields?.zipCode ?? null,
    country: profileFields?.country ?? null,
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
