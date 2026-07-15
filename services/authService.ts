import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged,
  type User,
  type Unsubscribe,
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, firestore } from "./firebaseClient";
import { apiPost, ApiClientError } from "./apiClient";
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

  return credential.user;
}

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
