import * as admin from "firebase-admin";
import { computeExpiresAt, UserTier } from "../_shared/tiers";

/**
 * Recomputes `expiresAt` on every live gallery doc for a user against the new
 * tier. On downgrade this shrinks the retention window (preventing the
 * loophole of stockpiling renders before downgrading); on upgrade it extends
 * the window. Docs already past their old `expiresAt` are left alone — they
 * will be cleaned up by `expireOldImages`.
 */
export async function recomputeExpiry(uid: string, newTier: UserTier): Promise<number> {
  const db = admin.firestore();
  const now = Date.now();
  const snap = await db.collection(`users/${uid}/gallery`).get();
  if (snap.empty) return 0;

  let updated = 0;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 100) {
    const chunk = docs.slice(i, i + 100);
    const batch = db.batch();
    let chunkCount = 0;
    for (const d of chunk) {
      const data = d.data() as { createdAt?: number; expiresAt?: number };
      if (typeof data.createdAt !== "number") continue;
      if (typeof data.expiresAt === "number" && data.expiresAt < now) continue;

      const recomputed = computeExpiresAt(data.createdAt, newTier);
      if (recomputed !== data.expiresAt) {
        batch.update(d.ref, { expiresAt: recomputed, tierAtCreation: newTier });
        chunkCount++;
      }
    }
    if (chunkCount > 0) await batch.commit();
    updated += chunkCount;
  }
  return updated;
}
