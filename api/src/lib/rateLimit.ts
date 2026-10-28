import * as admin from "firebase-admin";
import { createHash } from "crypto";

/**
 * Fixed-window rate limiting backed by Firestore.
 *
 * Used on the unauthenticated sign-in-link endpoint, which is the one place in
 * the API anyone on the internet can reach without a token. A fixed window is
 * coarser than a sliding one, but it costs a single transactional read/write
 * and the failure mode we care about -- someone pumping thousands of link
 * requests at other people's inboxes -- is caught just as well.
 *
 * Keys are hashed, so no raw IP address or email address is ever stored here.
 */

const COLLECTION = "authRateLimits";

export interface RateLimitRule {
  /** Logical bucket name, e.g. "ip" or "email". */
  readonly scope: string;
  /** Max requests permitted inside one window. */
  readonly max: number;
  /** Window length in milliseconds. */
  readonly windowMs: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** Which rule rejected the request, when one did. */
  scope?: string;
  /** Seconds until the caller may retry. */
  retryAfterSec?: number;
}

function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

/**
 * Consume one unit against a single rule. Returns whether it was allowed.
 *
 * The whole read-modify-write runs in a Firestore transaction so two concurrent
 * requests can't both see the same count and both be let through.
 */
async function consume(
  rule: RateLimitRule,
  rawKey: string,
  now: number,
): Promise<RateLimitVerdict> {
  const ref = admin
    .firestore()
    .doc(`${COLLECTION}/${rule.scope}:${hashKey(rawKey)}`);

  return admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists
      ? (snap.data() as { count?: number; windowStart?: number })
      : undefined;

    const windowStart = data?.windowStart ?? 0;
    const windowIsCurrent = now - windowStart < rule.windowMs;
    const count = windowIsCurrent ? data?.count ?? 0 : 0;

    if (count >= rule.max) {
      return {
        allowed: false,
        scope: rule.scope,
        retryAfterSec: Math.max(
          1,
          Math.ceil((windowStart + rule.windowMs - now) / 1000),
        ),
      };
    }

    tx.set(
      ref,
      {
        scope: rule.scope,
        count: count + 1,
        windowStart: windowIsCurrent ? windowStart : now,
        // So a sweep (or a TTL policy) can clear stale counters later.
        expiresAt: new Date((windowIsCurrent ? windowStart : now) + rule.windowMs),
      },
      { merge: true },
    );

    return { allowed: true };
  });
}

/**
 * Check every rule, stopping at the first rejection.
 *
 * Rules are evaluated in order and only consumed until one refuses, so a
 * request blocked by the per-email rule doesn't also burn the caller's per-IP
 * allowance.
 */
export async function checkRateLimits(
  rules: readonly { rule: RateLimitRule; key: string }[],
  now = Date.now(),
): Promise<RateLimitVerdict> {
  for (const { rule, key } of rules) {
    if (!key) continue;
    const verdict = await consume(rule, key, now);
    if (!verdict.allowed) return verdict;
  }
  return { allowed: true };
}

/** Stable, non-reversible identifier for logging an actor without storing PII. */
export function actorFingerprint(value: string): string {
  return hashKey(value).slice(0, 12);
}
