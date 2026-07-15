import * as admin from "firebase-admin";
import Stripe from "stripe";
import { GALLERY_BUCKET } from "./lib/storage";
import { USE_MOCK_STRIPE } from "./_shared/pricing";

export interface HardDeleteOutput {
  processed: number;
}

// Keep each run bounded; Cloud Scheduler invokes daily and a backlog clears
// over consecutive runs (mirrors expireOldImages).
const MAX_PER_RUN = 100;

/**
 * Permanently removes accounts whose 30-day soft-delete grace period has
 * elapsed (hardDeleteAt <= now). For each: delete gallery docs + Storage
 * objects, the Stripe customer, the user doc, and the Auth record.
 *
 * Idempotent and best-effort per user — a failure on one user is logged and
 * doesn't block the others. Only touches docs that were actually soft-deleted
 * (deletedAt present), so a stray hardDeleteAt can never nuke a live account.
 */
export async function handleHardDeleteExpiredAccounts(): Promise<HardDeleteOutput> {
  const db = admin.firestore();
  const bucket = admin.storage().bucket(GALLERY_BUCKET);
  const now = Date.now();

  const snap = await db
    .collection("users")
    .where("hardDeleteAt", "<=", now)
    .limit(MAX_PER_RUN)
    .get();

  if (snap.empty) {
    console.log(JSON.stringify({ severity: "INFO", event: "hard_delete_run", processed: 0 }));
    return { processed: 0 };
  }

  let processed = 0;
  for (const userDoc of snap.docs) {
    const uid = userDoc.id;
    const data = userDoc.data() as Record<string, unknown>;

    // Safety guard: never hard-delete an account that wasn't soft-deleted.
    if (!data.deletedAt) {
      console.warn(
        JSON.stringify({ severity: "WARNING", event: "hard_delete_skipped_no_deletedAt", uid }),
      );
      continue;
    }

    try {
      // 1. Gallery docs (users/{uid}/gallery/*)
      const gallerySnap = await db.collection(`users/${uid}/gallery`).get();
      for (let i = 0; i < gallerySnap.docs.length; i += 400) {
        const chunk = gallerySnap.docs.slice(i, i + 400);
        const batch = db.batch();
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      // 2. Storage objects under gallery/{uid}/ (images + thumbnails)
      try {
        await bucket.deleteFiles({ prefix: `gallery/${uid}/`, force: true });
      } catch (e) {
        console.warn(
          JSON.stringify({
            severity: "WARNING",
            event: "hard_delete_storage_failed",
            uid,
            error: (e as Error).message,
          }),
        );
      }

      // 3. Stripe customer
      if (!USE_MOCK_STRIPE && data.stripeCustomerId) {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (stripeKey) {
          try {
            const stripe = new Stripe(stripeKey);
            await stripe.customers.del(data.stripeCustomerId as string);
          } catch (e) {
            console.warn(
              JSON.stringify({
                severity: "WARNING",
                event: "hard_delete_stripe_failed",
                uid,
                error: (e as Error).message,
              }),
            );
          }
        }
      }

      // 4. User doc
      await userDoc.ref.delete();

      // 5. Auth record (was disabled at soft-delete; now remove entirely)
      try {
        await admin.auth().deleteUser(uid);
      } catch (e) {
        // auth/user-not-found is fine — treat as already gone.
        console.warn(
          JSON.stringify({
            severity: "WARNING",
            event: "hard_delete_auth_failed",
            uid,
            error: (e as Error).message,
          }),
        );
      }

      processed++;
      console.log(JSON.stringify({ severity: "INFO", event: "account_hard_deleted", uid }));
    } catch (e) {
      console.error(
        JSON.stringify({
          severity: "ERROR",
          event: "hard_delete_failed",
          uid,
          error: (e as Error).message,
        }),
      );
    }
  }

  console.log(JSON.stringify({ severity: "INFO", event: "hard_delete_run", processed }));
  return { processed };
}
