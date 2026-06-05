import { QUOTA_BY_TIER } from "../shared/tiers";
import type { UserAccount, UserTier } from "../types";

export type QuotaSeverity = "ok" | "warning" | "critical" | "exhausted";

export interface QuotaSnapshot {
  used: number;
  limit: number; // Number.POSITIVE_INFINITY when unlimited
  remaining: number; // Number.POSITIVE_INFINITY when unlimited
  isUnlimited: boolean;
  percentUsed: number; // 0-100; 0 if unlimited
  severity: QuotaSeverity;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function getDailyRendersUsed(user: UserAccount | null): number {
  if (!user) return 0;
  const cutoff = Date.now() - DAY_MS;
  return (user.renderTimestamps || []).filter((t) => t > cutoff).length;
}

export function getMonthlyRendersUsed(user: UserAccount | null): number {
  return user?.monthlyDesignCount ?? 0;
}

export function getDailyLimit(tier: UserTier): number {
  return QUOTA_BY_TIER[tier].daily;
}

export function getMonthlyLimit(tier: UserTier): number {
  return QUOTA_BY_TIER[tier].monthly;
}

/**
 * Returns the epoch-ms timestamp at which this user's monthly quota next
 * resets. Mirrors the backend `nextResetAt`:
 *   - Paid tier with a future `currentPeriodEnd` → align to billing period.
 *   - Otherwise → fall back to the doc's `monthlyResetAt` (calendar-month for
 *     freemium, kept fresh server-side).
 */
export function getMonthlyResetAt(user: UserAccount | null): number | null {
  if (!user) return null;
  const now = Date.now();
  if (user.tier !== "freemium" && user.currentPeriodEnd && user.currentPeriodEnd > now) {
    return user.currentPeriodEnd;
  }
  return user.monthlyResetAt || null;
}

function severityFor(percentUsed: number, isExhausted: boolean): QuotaSeverity {
  if (isExhausted) return "exhausted";
  if (percentUsed >= 75) return "critical";
  if (percentUsed >= 50) return "warning";
  return "ok";
}

export function getDailyQuotaSnapshot(user: UserAccount | null): QuotaSnapshot {
  const limit = user ? getDailyLimit(user.tier) : 0;
  const used = getDailyRendersUsed(user);
  return buildSnapshot(used, limit);
}

export function getMonthlyQuotaSnapshot(user: UserAccount | null): QuotaSnapshot {
  const limit = user ? getMonthlyLimit(user.tier) : 0;
  const used = getMonthlyRendersUsed(user);
  return buildSnapshot(used, limit);
}

function buildSnapshot(used: number, limit: number): QuotaSnapshot {
  const isUnlimited = !isFinite(limit);
  if (isUnlimited) {
    return {
      used,
      limit: Number.POSITIVE_INFINITY,
      remaining: Number.POSITIVE_INFINITY,
      isUnlimited: true,
      percentUsed: 0,
      severity: "ok",
    };
  }
  const remaining = Math.max(0, limit - used);
  const percentUsed = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const isExhausted = used >= limit;
  return {
    used,
    limit,
    remaining,
    isUnlimited: false,
    percentUsed,
    severity: severityFor(percentUsed, isExhausted),
  };
}

/**
 * Convenience: returns true when the next render would exceed either window.
 * Used by the Remodeler to disable the render button before the user even
 * clicks, mirroring the server-side `reserveRenderSlot` guard.
 */
export function isQuotaExhausted(user: UserAccount | null): boolean {
  if (!user) return false;
  const daily = getDailyQuotaSnapshot(user);
  const monthly = getMonthlyQuotaSnapshot(user);
  return daily.severity === "exhausted" || monthly.severity === "exhausted";
}
