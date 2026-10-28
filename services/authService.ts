import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  onAuthStateChanged,
  type User,
  type Unsubscribe,
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, firestore } from "./firebaseClient";
import { apiPost, apiPostPublic, ApiClientError } from "./apiClient";
import { validateSignupProfile, type SignupProfile } from "../shared/profile";

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_NUMBER_REGEX = /\d/;
// local-part @ domain-label . tld(2+ chars). Mirrors what Firebase server-side accepts.
const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@]{2,}$/;

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!PASSWORD_NUMBER_REGEX.test(password)) {
    return "Password must contain at least one number.";
  }
  return null;
}

export function validateEmailFormat(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Email is required.";
  if (!EMAIL_REGEX.test(trimmed)) {
    return "Please enter a valid email like name@domain.com.";
  }
  return null;
}

export async function signUp(
  email: string,
  password: string,
  profile: SignupProfile,
): Promise<User> {
  const policyError = validatePassword(password);
  if (policyError) throw new Error(policyError);
  const profileError = validateSignupProfile(profile);
  if (profileError) throw new Error(profileError);

  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(credential.user);

  // Best-effort: bootstrap the user doc on the server, passing the collected
  // profile. If this fails (network glitch, server cold start), the proxy routes
  // will return `failed-precondition` / `no_user_doc` on first use and the
  // frontend can prompt a retry. Don't fail signup on this.
  let bootstrapped = false;
  try {
    await apiPost<{ profile: SignupProfile }, { created: boolean; uid: string }>(
      "/internal/onSignup",
      { profile },
    );
    bootstrapped = true;
  } catch (e) {
    if (!(e instanceof ApiClientError)) throw e;
    console.warn("Post-signup bootstrap failed (will be retried on first use):", e);
  }

  if (bootstrapped) {
    const now = Date.now();
    try {
      await updateDoc(doc(firestore, `users/${credential.user.uid}`), {
        acceptedTermsAt: now,
        acceptedPrivacyAt: now,
      });
    } catch (e) {
      console.warn("Failed to persist T&C / Privacy acceptance timestamps:", e);
    }
  }

  // GA4 conversion: a new account was created. Guarded — gtag is only present
  // in the browser once the analytics snippet has loaded.
  try {
    (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag?.(
      "event",
      "sign_up",
      { method: "email" },
    );
  } catch {
    // analytics must never break the signup flow
  }

  return credential.user;
}

// --- Passwordless (email link) sign-in ---------------------------------------

/**
 * Where the sign-in email is stored between requesting the link and clicking it.
 *
 * Firebase requires the address to complete the sign-in, and deliberately does
 * not put it in the link (anyone who intercepted the URL could then sign in as
 * that person). Keeping it here means the common case -- request and click in the
 * same browser -- needs no retyping; a different browser falls back to asking.
 */
const PENDING_EMAIL_KEY = "prhomz.pendingSignInEmail";

/**
 * Whether the UI should offer the passwordless path at all.
 *
 * Build-time flag, so a production build (which does not set it) renders the
 * existing password screens unchanged even with this code compiled in.
 */
export function passwordlessEnabled(): boolean {
  return (import.meta.env.VITE_PASSWORDLESS_AUTH as string | undefined) === "on";
}

/** The server turned the feature off — callers should show the password form. */
export const PASSWORDLESS_DISABLED = "passwordless_disabled";

function reasonOf(error: unknown): string | undefined {
  if (!(error instanceof ApiClientError)) return undefined;
  return (error.details as { reason?: string } | undefined)?.reason;
}

/**
 * Ask for a sign-in link.
 *
 * Two steps on purpose: our own gate decides whether the request is allowed
 * (throwaway domain, rate limits) and records the user's acceptance of the Terms
 * and Privacy Policy, and only then does Firebase send the email. If the gate
 * refuses, no email is sent.
 *
 * Throws an Error whose message is `PASSWORDLESS_DISABLED` when the server-side
 * flag is off, so the caller can fall back rather than show a dead end.
 */
export async function requestEmailLink(
  email: string,
  consent: { acceptedTerms: boolean; acceptedPrivacy: boolean },
): Promise<void> {
  const trimmed = email.trim();
  const formatError = validateEmailFormat(trimmed);
  if (formatError) throw new Error(formatError);

  try {
    await apiPostPublic<
      { email: string; acceptedTerms: boolean; acceptedPrivacy: boolean },
      { allowed: true }
    >("/auth/requestEmailLink", {
      email: trimmed,
      acceptedTerms: consent.acceptedTerms,
      acceptedPrivacy: consent.acceptedPrivacy,
    });
  } catch (e) {
    if (reasonOf(e) === PASSWORDLESS_DISABLED) throw new Error(PASSWORDLESS_DISABLED);
    throw e;
  }

  await sendSignInLinkToEmail(auth, trimmed, {
    // Must be an authorized domain on the Firebase project. Using the current
    // origin keeps staging and production each pointing at themselves.
    url: `${window.location.origin}/`,
    handleCodeInApp: true,
  });

  try {
    window.localStorage.setItem(PENDING_EMAIL_KEY, trimmed);
  } catch {
    // Private browsing can refuse storage; the user will just be asked to
    // re-enter their address when they click the link.
  }
}

/** True when the current URL is a Firebase sign-in link. */
export function isIncomingEmailLink(): boolean {
  try {
    return isSignInWithEmailLink(auth, window.location.href);
  } catch {
    return false;
  }
}

/**
 * The sign-in link for this page load, held in memory once the address bar has
 * been cleared. Module-level so the capture happens exactly once even if React
 * renders the detecting component twice (StrictMode) or two callers ask.
 */
let capturedLink: string | null = null;

/**
 * Detect an incoming sign-in link, take a copy, and strip it from the address
 * bar straight away.
 *
 * The link carries `oobCode` — the actual sign-in credential. Left in the URL it
 * shows in the address bar and, worse, is written to browser history, where it
 * outlives the sign-in on a shared machine. Clearing it before we start the
 * network round-trip (rather than after) means it is never visible and never
 * recorded, while the in-memory copy completes the sign-in as normal.
 *
 * `apiKey`, also in that URL, is only a project identifier — it ships in the
 * client bundle and is not a secret — but there is no reason to leave it either.
 *
 * Returns true when this page load is a sign-in link.
 */
export function captureIncomingEmailLink(): boolean {
  if (capturedLink) return true;
  if (!isIncomingEmailLink()) return false;

  capturedLink = window.location.href;
  try {
    window.history.replaceState({}, "", window.location.pathname);
  } catch {
    // Non-fatal: sign-in still works, the parameters just stay in the bar.
  }
  return true;
}

/** The address the link was requested for, if it was requested in this browser. */
export function getPendingSignInEmail(): string | null {
  try {
    return window.localStorage.getItem(PENDING_EMAIL_KEY);
  } catch {
    return null;
  }
}

export function clearPendingSignInEmail(): void {
  try {
    window.localStorage.removeItem(PENDING_EMAIL_KEY);
  } catch {
    // nothing to do
  }
}

/**
 * Finish a passwordless sign-in and make sure the account is usable.
 *
 * Email-link sign-in marks the address verified, so the user lands straight in
 * the app — which means the Firestore user document has to exist by then or they
 * sit on the "Preparing your studio…" spinner forever. Hence the bootstrap call
 * before we return.
 */
export async function completeEmailLinkSignIn(email: string): Promise<User> {
  // Prefer the copy taken before the address bar was cleared; fall back to the
  // live URL for any caller that did not go through captureIncomingEmailLink.
  const link = capturedLink ?? window.location.href;
  const credential = await signInWithEmailLink(auth, email.trim(), link);
  clearPendingSignInEmail();

  const isNewAccount = await ensureUserDoc();

  if (isNewAccount) {
    // GA4 conversion, same event the password path fires.
    try {
      (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag?.(
        "event",
        "sign_up",
        { method: "email_link" },
      );
    } catch {
      // analytics must never break sign-in
    }
  }

  return credential.user;
}

/**
 * Create the Firestore user document if it is missing. Idempotent server-side.
 *
 * No profile is sent: passwordless accounts have no profile fields, and the
 * server tolerates their absence. Returns true when a document was created.
 */
export async function ensureUserDoc(): Promise<boolean> {
  try {
    const result = await apiPost<Record<string, never>, { created: boolean; uid: string }>(
      "/internal/onSignup",
      {},
    );
    return result.created;
  } catch (e) {
    console.warn("User-doc bootstrap failed; will retry on next load:", e);
    return false;
  }
}

// --- Password sign-in --------------------------------------------------------

export async function signIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth);
}

export async function resendVerification(): Promise<void> {
  if (!auth.currentUser) throw new Error("Not signed in");
  await sendEmailVerification(auth.currentUser);
}

export async function sendReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export interface DeleteAccountResult {
  deleted: boolean;
  uid: string;
  hardDeleteAt: number;
}

/**
 * Soft-delete the current user's account.
 *
 * Backend cancels Stripe, anonymizes feedback, marks deletedAt + hardDeleteAt
 * on the user doc, and disables the Auth record. We then sign the user out
 * locally so the session ends immediately.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const result = await apiPost<Record<string, never>, DeleteAccountResult>(
    "/deleteAccount",
    {},
  );
  await fbSignOut(auth);
  return result;
}

export function onAuthChange(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}
