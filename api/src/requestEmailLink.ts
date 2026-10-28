import * as admin from "firebase-admin";
import { createHash } from "crypto";
import { ApiError } from "./lib/apiError";
import { isDisposableEmailDomain } from "./lib/disposableDomains";
import {
  checkRateLimits,
  actorFingerprint,
  type RateLimitRule,
} from "./lib/rateLimit";

/**
 * Gate in front of passwordless sign-in links.
 *
 * Firebase itself sends the link, from the browser, so this endpoint does not
 * send any email. What it does is decide whether the client is *allowed* to ask
 * for one, and record the user's acceptance of the Terms and Privacy Policy at
 * the moment they ask -- which is the only point in a passwordless flow where
 * there is a form to accept them on.
 *
 * It is the only unauthenticated POST route in the API (the caller has no
 * account yet, by definition), so the abuse controls live here rather than in
 * middleware: a throwaway-domain check and two fixed-window rate limits.
 *
 * A determined attacker can call the Firebase SDK directly and skip this gate
 * entirely -- Identity Platform's own per-project email quotas are the backstop
 * for that. What this stops is the realistic case: someone using our own UI to
 * pump links at inboxes, and accounts created on throwaway addresses that can
 * never be recovered.
 */

/** Per-address: enough for a few honest retries, not enough to spam an inbox. */
const EMAIL_RULE: RateLimitRule = {
  scope: "email",
  max: 5,
  windowMs: 60 * 60 * 1000,
};

/** Per-IP: covers a household or small office sharing one address. */
const IP_RULE: RateLimitRule = {
  scope: "ip",
  max: 10,
  windowMs: 60 * 60 * 1000,
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@]{2,}$/;
const MAX_EMAIL_LENGTH = 254;

export const CONSENT_COLLECTION = "emailConsents";

export interface RequestEmailLinkInput {
  email?: unknown;
  acceptedTerms?: unknown;
  acceptedPrivacy?: unknown;
}

export interface RequestEmailLinkOutput {
  /** The client may now call sendSignInLinkToEmail. */
  allowed: true;
}

/** Stable id for a consent record, so we never key a document on a raw address. */
export function emailConsentId(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function passwordlessEnabled(): boolean {
  return (process.env.PASSWORDLESS_AUTH || "").toLowerCase() === "on";
}

export async function handleRequestEmailLink(
  body: RequestEmailLinkInput | undefined,
  ip: string | undefined,
): Promise<RequestEmailLinkOutput> {
  // Single server-side off-switch for the whole feature. The frontend treats
  // this specific reason as "fall back to the password form", so flipping the
  // env var reverts behaviour without a frontend deploy.
  if (!passwordlessEnabled()) {
    throw new ApiError(
      "failed-precondition",
      "Passwordless sign-in is not enabled.",
      { reason: "passwordless_disabled" },
    );
  }

  const rawEmail = typeof body?.email === "string" ? body.email.trim() : "";
  const email = rawEmail.toLowerCase();

  if (!email) {
    throw new ApiError("invalid-argument", "Email is required.", {
      reason: "email_missing",
    });
  }
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(email)) {
    throw new ApiError(
      "invalid-argument",
      "Please enter a valid email like name@domain.com.",
      { reason: "email_invalid" },
    );
  }
  if (body?.acceptedTerms !== true || body?.acceptedPrivacy !== true) {
    throw new ApiError(
      "invalid-argument",
      "Please accept the Terms & Conditions and Privacy Policy to continue.",
      { reason: "consent_required" },
    );
  }
  if (isDisposableEmailDomain(email)) {
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        event: "email_link_domain_blocked",
        emailFingerprint: actorFingerprint(email),
      }),
    );
    throw new ApiError(
      "invalid-argument",
      "Temporary email addresses can't be used. Your email address is how you sign in, so it needs to be one you'll keep.",
      { reason: "email_domain_not_allowed" },
    );
  }

  const verdict = await checkRateLimits([
    { rule: EMAIL_RULE, key: email },
    { rule: IP_RULE, key: ip || "" },
  ]);
  if (!verdict.allowed) {
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        event: "email_link_rate_limited",
        scope: verdict.scope,
        emailFingerprint: actorFingerprint(email),
        retryAfterSec: verdict.retryAfterSec,
      }),
    );
    throw new ApiError(
      "resource-exhausted",
      verdict.scope === "email"
        ? "We've already sent several sign-in links to this address. Please check your inbox, including spam, and try again later."
        : "Too many sign-in requests from this network. Please try again later.",
      { reason: "rate_limited", retryAfterSec: verdict.retryAfterSec },
    );
  }

  // Record consent at the moment it is given. Keyed by a hash of the address
  // because the user has no uid yet; handleOnSignup copies these timestamps onto
  // the user document once the account exists.
  const now = Date.now();
  try {
    await admin
      .firestore()
      .doc(`${CONSENT_COLLECTION}/${emailConsentId(email)}`)
      .set(
        {
          email,
          acceptedTermsAt: now,
          acceptedPrivacyAt: now,
          method: "email_link",
          updatedAt: now,
        },
        { merge: true },
      );
  } catch (e) {
    // A missing consent record is recoverable (handleOnSignup falls back to the
    // time the account was created), so don't block sign-in on this write.
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        event: "email_consent_write_failed",
        emailFingerprint: actorFingerprint(email),
        error: (e as Error).message,
      }),
    );
  }

  console.log(
    JSON.stringify({
      severity: "INFO",
      event: "email_link_requested",
      emailFingerprint: actorFingerprint(email),
    }),
  );

  return { allowed: true };
}
