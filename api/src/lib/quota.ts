import * as admin from "firebase-admin";
import { QUOTA_BY_TIER, UserTier, startOfNextMonthUTC } from "../_shared/tiers";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Computes the next monthly-quota reset moment for a user.
 *
 *   - Paid tier with a future Stripe period end → align to it (so quota resets
 *     when the billing cycle rolls over).
 *   - Freemium, or stale/missing period end → fall back to start of next
 *     calendar month UTC so the user still rolls eventually.
 */
export function nextResetAt(tier: UserTier, currentPeriodEnd: number, now: number): number {
  if (tier !== "freemium" && currentPeriodEnd > now) {
    return currentPeriodEnd;
  }
  return startOfNextMonthUTC();
}

export interface QuotaCheckResult {
  ok: boolean;
  reason?: "monthly_exceeded" | "daily_exceeded" | "no_user_doc";
  monthlyUsed: number;
  monthlyLimit: number;
  dailyUsed: number;
  dailyLimit: number;
  tier: UserTier;
}

/**
 * Atomically checks tier-specific monthly + daily render quotas and reserves
 * a slot if available. Counters are updated inside a Firestore transaction so
 * two concurrent renders can't both squeeze through the last slot.
 *
 * Returns `ok: false` with a `reason` if either window is exhausted; the
 * counters are not incremented in that case.
 */
export async function reserveRenderSlot(
  uid: string,
): Promise<QuotaCheckResult> {
  const db = admin.firestore();
  const userRef = db.doc(`users/${uid}`);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) {
      return {
        ok: false,
        reason: "no_user_doc" as const,
        monthlyUsed: 0,
        monthlyLimit: 0,
        dailyUsed: 0,
        dailyLimit: 0,
        tier: "freemium" as UserTier,
      };
    }

    const data = snap.data() as Record<string, unknown>;
    const tier = ((data.tier as UserTier) || "freemium") as UserTier;
    const quota = QUOTA_BY_TIER[tier];

    const now = Date.now();
    const currentPeriodEnd = (data.currentPeriodEnd as number) || 0;

    // Lazy monthly reset.
    //   - Paid tiers align to the Stripe billing period (currentPeriodEnd),
    //     so a user who subscribes on the 29th resets on the 29th of next month,
    //     not on the calendar 1st. The Stripe webhook keeps currentPeriodEnd
    //     fresh, but in the rare case it's stale or missing we fall back to
    //     calendar-month to avoid an infinite-reset loop.
    //   - Freemium stays calendar-month — no billing event to align to.
    let monthlyCount = (data.monthlyDesignCount as number) || 0;
    let monthlyResetAt = (data.monthlyResetAt as number) || nextResetAt(tier, currentPeriodEnd, now);
    if (now >= monthlyResetAt) {
      monthlyCount = 0;
      monthlyResetAt = nextResetAt(tier, currentPeriodEnd, now);
    }

    // Rolling 24h daily window
    const dayAgo = now - DAY_MS;
    const trimmedTimestamps = ((data.renderTimestamps as number[]) || []).filter(
      (t) => t > dayAgo,
    );
    const dailyCount = trimmedTimestamps.length;

    if (monthlyCount >= quota.monthly) {
      return {
        ok: false,
        reason: "monthly_exceeded" as const,
        monthlyUsed: monthlyCount,
        monthlyLimit: quota.monthly,
        dailyUsed: dailyCount,
        dailyLimit: quota.daily,
        tier,
      };
    }

    if (dailyCount >= quota.daily) {
      return {
        ok: false,
        reason: "daily_exceeded" as const,
        monthlyUsed: monthlyCount,
        monthlyLimit: quota.monthly,
        dailyUsed: dailyCount,
        dailyLimit: quota.daily,
        tier,
      };
    }

    // Reserve the slot
    monthlyCount += 1;
    trimmedTimestamps.push(now);

    tx.update(userRef, {
      monthlyDesignCount: monthlyCount,
      monthlyResetAt,
      renderTimestamps: trimmedTimestamps,
      totalRenders: ((data.totalRenders as number) || 0) + 1,
      lastActive: now,
    });

    return {
      ok: true,
      monthlyUsed: monthlyCount,
      monthlyLimit: quota.monthly,
      dailyUsed: dailyCount + 1,
      dailyLimit: quota.daily,
      tier,
    };
  });
}
