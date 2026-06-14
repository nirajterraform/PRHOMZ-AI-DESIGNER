import * as admin from "firebase-admin";
import Stripe from "stripe";
import { ApiError } from "./lib/apiError";
import { USE_MOCK_STRIPE } from "./_shared/pricing";

export interface DeleteAccountOutput {
  deleted: boolean;
  uid: string;
  hardDeleteAt: number; // epoch ms when scheduled cleanup will hard-delete
}

const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Soft-deletes the calling user's account.
 *
 * Steps (best-effort; later steps still run if earlier ones fail):
 *   1. Cancel any active Stripe subscription (immediate, no proration).
 *   2. Anonymize all feedback rows authored by this uid (overwrite `email`).
 *   3. Mark the user doc with `deletedAt` and revert tier to freemium.
 *   4. Disable the Firebase Auth user so they cannot sign back in.
 *
 * Actual hard delete (Storage files, gallery docs, user doc, Auth record,
 * Stripe customer) runs after the grace period via a scheduled cleanup job.
 */
export async function handleDeleteAccount(uid: string): Promise<DeleteAccountOutput> {
  if (!uid) throw new ApiError("invalid-argument", "uid required.");

  const db = admin.firestore();
  const userRef = db.doc(`users/${uid}`);
  const snap = await userRef.get();
  if (!snap.exists) {
    throw new ApiError("failed-precondition", "User profile not found.");
  }
  const data = snap.data() as Record<string, unknown>;
  const subscriptionId = (data.subscriptionId as string | null) || null;
  const now = Date.now();

  // 1. Cancel Stripe subscription (best-effort)
  if (!USE_MOCK_STRIPE && subscriptionId) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      try {
        const stripe = new Stripe(stripeKey);
        await stripe.subscriptions.cancel(subscriptionId);
        console.log(
          JSON.stringify({
            severity: "INFO",
            event: "account_delete_subscription_canceled",
            uid,
            subscriptionId,
          }),
        );
      } catch (e) {
        console.warn(
          JSON.stringify({
            severity: "WARNING",
            event: "account_delete_subscription_cancel_failed",
            uid,
            subscriptionId,
            error: (e as Error).message,
          }),
        );
      }
    }
  }

  // 2. Anonymize feedback rows
  try {
    const feedbackSnap = await db.collection("feedback").where("uid", "==", uid).get();
    if (!feedbackSnap.empty) {
      const docs = feedbackSnap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const chunk = docs.slice(i, i + 400);
        const batch = db.batch();
        for (const d of chunk) {
          batch.update(d.ref, { email: "[deleted]" });
        }
        await batch.commit();
      }
      console.log(
        JSON.stringify({
          severity: "INFO",
          event: "account_delete_feedback_anonymized",
          uid,
          count: feedbackSnap.size,
        }),
      );
    }
  } catch (e) {
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        event: "account_delete_feedback_anonymize_failed",
        uid,
        error: (e as Error).message,
      }),
    );
  }

  // 3. Mark user doc as soft-deleted
  const hardDeleteAt = now + GRACE_PERIOD_MS;
  await userRef.update({
    deletedAt: now,
    hardDeleteAt,
    tier: "freemium",
    subscriptionStatus: null,
    lastActive: now,
  });

  // 4. Disable Auth user so they cannot sign back in
  try {
    await admin.auth().updateUser(uid, { disabled: true });
    console.log(
      JSON.stringify({
        severity: "INFO",
        event: "account_delete_auth_disabled",
        uid,
      }),
    );
  } catch (e) {
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        event: "account_delete_auth_disable_failed",
        uid,
        error: (e as Error).message,
      }),
    );
  }

  console.log(
    JSON.stringify({
      severity: "INFO",
      event: "account_deleted_soft",
      uid,
      hardDeleteAt,
    }),
  );

  return { deleted: true, uid, hardDeleteAt };
}
