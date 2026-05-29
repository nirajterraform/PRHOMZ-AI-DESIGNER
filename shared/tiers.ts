export type UserTier = 'freemium' | 'basic' | 'advanced' | 'designer';

export const RETENTION_DAYS_BY_TIER: Record<UserTier, number> = {
  freemium: 1,
  basic: 7,
  advanced: 15,
  designer: 30,
};

export const QUOTA_BY_TIER: Record<UserTier, { monthly: number; daily: number }> = {
  freemium: { monthly: 10, daily: 2 },
  basic: { monthly: 100, daily: 5 },
  advanced: { monthly: 300, daily: Number.POSITIVE_INFINITY },
  designer: { monthly: Number.POSITIVE_INFINITY, daily: Number.POSITIVE_INFINITY },
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computeExpiresAt(createdAtMs: number, tier: UserTier): number {
  return createdAtMs + RETENTION_DAYS_BY_TIER[tier] * MS_PER_DAY;
}

export function startOfNextMonthUTC(now: Date = new Date()): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0);
}
