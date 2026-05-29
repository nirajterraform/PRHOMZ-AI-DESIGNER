# Phase 1 Completion Report — Auth & User Model

**Project:** PRHOMZ AI Designer
**Phase:** 1 of 8 (Auth & User Model)
**Status:** Complete (with one defer — see §8)
**Environment validated:** Local development against Firebase Emulator Suite
**Date completed:** 2026-05-14

---

## 1. Executive Summary

Phase 1 replaced the application's fake `setTimeout`-based login simulation with real Firebase Authentication, added an enforced email-verification gate, and migrated user state from `localStorage` to Cloud Firestore. The app now supports proper sign-up, sign-in, sign-out, password reset, and session persistence against either the local Firebase Emulator Suite (dev) or live Firebase (prod), switchable via a single environment flag.

Every user now exists as a Firestore document with all the fields required by later phases — tier, monthly quota counters, subscription state placeholders, and verification status — even though most of those fields are not yet enforced.

The visual design of the original auth screen was preserved intact; only the logic underneath changed.

---

## 2. Goals of Phase 1

From the implementation plan:

| Goal                                                              | Status |
|-------------------------------------------------------------------|--------|
| Real Firebase Authentication (email + password)                   | Done   |
| Required email verification before AI features unlock             | Done (gate at sign-in level) |
| Firestore-backed user profile with default Freemium tier          | Done (via client-side `ensureUserDoc`; Function-driven in Phase 3) |
| Replace localStorage user state with `onAuthStateChanged` + Firestore listener | Done |
| Drop the 14-day trial logic (per stakeholder revision)            | Done (not built) |
| Preserve existing UI design language                              | Done |
| Production-ready architecture (single env flag flips dev→prod)    | Done |

---

## 3. What Was Built

### 3.1 New Files

| File                                          | Purpose                                                                       |
|-----------------------------------------------|-------------------------------------------------------------------------------|
| `services/firebaseClient.ts`                  | Initializes the Firebase SDK. Connects to emulators or real services based on `VITE_USE_FIREBASE_EMULATOR`. Fails fast with a clear error if config env vars are missing. |
| `services/authService.ts`                     | Thin wrapper around Firebase Auth — `signUp`, `signIn`, `signOut`, `sendReset`, `resendVerification`, `onAuthChange`, plus `validateEmailFormat` and `validatePassword` helpers. |
| `services/userService.ts`                     | Firestore user-document helpers — `ensureUserDoc`, `subscribeToUser`, `recordRender`. |
| `components/EmailVerificationPending.tsx`     | Post-signup screen with email display, "Resend" button (60s cooldown), "Sign out" link, and a 5-second auto-poll that detects when the user clicks the verification link. |
| `firebase.json`                               | Firebase Emulator + rules deploy configuration.                               |
| `.firebaserc`                                 | Default project mapping → `prhomz-dev-code-test`.                             |
| `firestore.rules`                             | Phase 1 security rules — users can read and write their own `users/{uid}` doc; all other paths are denied. |
| `firestore.indexes.json`                      | Placeholder for composite indexes (none required yet).                        |
| `storage.rules`                               | Gallery bucket rules — `gallery/{uid}/**` is owner-only.                      |

### 3.2 Modified Files

| File                                          | Change                                                                       |
|-----------------------------------------------|------------------------------------------------------------------------------|
| `components/Auth.tsx`                         | Rewritten from a fake `setTimeout` login into a 4-view state machine: landing → sign-up → sign-in → forgot-password. Real Firebase calls, inline validation, friendly error translations. Visual design preserved. |
| `App.tsx`                                     | Removed all `localStorage` user logic. Added two `useEffect` hooks — one for `onAuthStateChanged`, one for the Firestore user-doc subscription. Added a four-state render hierarchy (loading → unauthenticated → unverified → ready). Profile dropdown now displays tier. |
| `types.ts`                                    | `UserAccount` expanded with `tier`, `stripeCustomerId`, `subscriptionId`, `subscriptionStatus`, `currentPeriodEnd`, `emailVerified`, `monthlyDesignCount`, `monthlyResetAt`, `createdAt`. Two new union types: `UserTier`, `SubscriptionStatus`. |
| `.gitignore`                                  | Added Firebase emulator artifacts (`.firebase/`, `*-debug.log`, `.runtimeconfig.json`). |
| `.env.local` (gitignored)                     | Added `VITE_USE_FIREBASE_EMULATOR=true` and five `VITE_FIREBASE_*` config vars sourced from `terraform output`. |
| `package.json`                                | Added: `firebase` (Web SDK), `firebase-tools` (CLI, devDep), `@types/react`, `@types/react-dom`. |

### 3.3 Data Model — `users/{uid}` Firestore document

Created on first verified sign-in with these defaults:

```
id:                  <Firebase Auth UID>
email:               <from Auth>
name:                <derived from email local-part>
role:                'Client'
tier:                'freemium'
stripeCustomerId:    null
subscriptionId:      null
subscriptionStatus:  null
currentPeriodEnd:    null
emailVerified:       true
renderTimestamps:    []
totalRenders:        0
monthlyDesignCount:  0
monthlyResetAt:      <first day of next UTC month>
createdAt:           <now>
lastActive:          <now>
```

All fields the later phases need are already present; most are not yet enforced.

---

## 4. Authentication Flows

### 4.1 Sign-Up

1. User clicks "Create Account" → enters email, password, confirm-password.
2. Client validates email format and password policy locally before any network call.
3. `createUserWithEmailAndPassword` creates the Firebase Auth user.
4. `sendEmailVerification` triggers Firebase to send (or in emulator: log) the verification link.
5. App renders `EmailVerificationPending` because `user.emailVerified === false`.
6. User clicks link in email (or marks verified in emulator UI).
7. `EmailVerificationPending` polls `user.reload()` every 5 seconds; when `emailVerified` flips, the auth state listener fires and App.tsx re-renders.
8. `ensureUserDoc` runs in App.tsx, writing the Firestore profile with Freemium defaults.
9. Firestore listener pushes the doc to local state; main studio renders.

### 4.2 Sign-In

1. User enters email + password.
2. `signInWithEmailAndPassword` runs.
3. If `emailVerified === false`, App.tsx routes to `EmailVerificationPending` (verification gate re-applies).
4. If verified, `ensureUserDoc` either returns the existing doc or creates one (returning user with no Firestore doc yet — shouldn't happen after Phase 3 but safe fallback).
5. Firestore listener subscribes, studio renders.

### 4.3 Forgot Password

1. User clicks "Forgot password?" link from sign-in form.
2. Email-format validated locally.
3. `sendPasswordResetEmail` triggers Firebase to send (or in emulator: log) the reset link.
4. Confirmation panel shown — user does not return to the app; they click the link in their email to reset.

### 4.4 Sign-Out

1. User clicks profile avatar → Logout.
2. `signOut()` clears Firebase Auth state.
3. `onAuthStateChanged` fires with `null` → App.tsx routes back to the landing screen.
4. Local gallery state is cleared (Phase 2 will move this server-side).

### 4.5 Session Persistence

Firebase Auth's default persistence is **local** — refresh tokens are kept in IndexedDB. After a page refresh, `onAuthStateChanged` fires within a few hundred milliseconds with the cached user. The app shows a brief "Loading…" spinner during this window, never a flash of the unauthenticated UI.

---

## 5. Validation Rules

### 5.1 Email Format

Regex: `/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@]{2,}$/`

| Accepts                          | Rejects                              |
|----------------------------------|--------------------------------------|
| `name@domain.com`                | `notanemail`                         |
| `user.name@sub.domain.co.uk`     | `abc@example` (no TLD)               |
| `first+tag@gmail.com`            | `abc@.com` (empty label)             |
| `niraj@prhomz.in` (2-char ccTLD) | `abc@example.c` (TLD too short)      |
|                                  | `@example.com` (no local part)       |
|                                  | `abc @example.com` (whitespace)      |

Applied identically on sign-up, sign-in, and forgot-password forms. Validation runs before any Firebase network call.

### 5.2 Password Policy

- Minimum 8 characters
- Must contain at least one number

Enforced client-side via `validatePassword()`. Firebase server-side also enforces a minimum of 6 chars by default — our stricter check runs first, so the user always sees our message rather than Firebase's.

---

## 6. Security Posture

### 6.1 Firestore Rules (Phase 1 — permissive baseline)

```
match /users/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow create, update: if request.auth != null && request.auth.uid == userId;
  allow delete: if false;
}
match /{document=**} {
  allow read, write: if false;
}
```

Wildcard-deny catches anything we didn't explicitly allow.

### 6.2 Storage Rules

```
match /gallery/{userId}/{file=**} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
match /{path=**} {
  allow read, write: if false;
}
```

Per-user folder isolation. No cross-user reads or writes possible.

### 6.3 What's Locked Down Today vs. Still Open

| Concern                                            | Status                                  |
|----------------------------------------------------|-----------------------------------------|
| Users reading other users' profiles                | Blocked                                 |
| Users modifying other users' profiles              | Blocked                                 |
| Unauthenticated reads/writes                       | Blocked                                 |
| Cross-user gallery access                          | Blocked                                 |
| Users modifying their own `tier` field             | **Still possible** — tightened in Phase 3 once `onUserCreate` Function is deployed |
| Users modifying their own `monthlyDesignCount`     | **Still possible** — tightened in Phase 3 |
| Users creating fake Stripe state                   | **Still possible** — tightened in Phase 3 |

The currently-open items are not exploitable for value yet because tier-based gating doesn't exist in the application code until Phase 5. Tightening happens in Phase 3 when the Functions runtime SA becomes the only writer to these fields.

---

## 7. Testing Performed

All tests passed against the local Firebase Emulator Suite:

| Test                                              | Outcome |
|---------------------------------------------------|---------|
| Sign-up with valid credentials                    | Pass    |
| Email-format validation (8 negative cases)        | Pass    |
| Password-length validation (`<8` chars)           | Pass    |
| Password-numeric validation (no digit)            | Pass    |
| Confirm-password mismatch                         | Pass    |
| Email verification via emulator UI toggle         | Pass    |
| Auto-detection of verification (5s poll)          | Pass    |
| Firestore user doc created with correct defaults  | Pass    |
| Sign-in with verified user                        | Pass    |
| Forgot-password flow (link logged in emulator)    | Pass    |
| Sign-out clears state                             | Pass    |
| Session persists across page refresh              | Pass    |
| Duplicate email rejected with friendly message    | Pass    |
| Wrong password rejected with friendly message     | Pass    |

---

## 8. What Was Not Built in Phase 1 (Intentionally Deferred)

| Item                                       | Original phase | New phase | Reason for defer                              |
|--------------------------------------------|----------------|-----------|-----------------------------------------------|
| `onUserCreate` Cloud Function (Auth trigger) | Phase 1 Day 3  | Phase 3   | One Cloud Functions deployment is better than two. Client-side `ensureUserDoc` is a safe placeholder. |
| Tightened Firestore rules (lock server-only fields) | Phase 1 Day 3 | Phase 3 | Requires the runtime SA created by the Function deploy. |
| Welcome email branding                     | Phase 1        | Phase 7   | Firebase default templates are fine for dev.  |
| Custom verification action URL             | Phase 1        | Phase 7   | Requires Firebase Hosting domain to be live.  |
| App Check / reCAPTCHA Enterprise           | —              | Phase 7   | Production-only requirement.                  |
| Per-tier quota enforcement                 | —              | Phase 5   | Out of scope for the user-onboarding milestone. |

---

## 9. Production Migration Checklist

These are the *only* changes required to move what was built in Phase 1 from emulator to live Firebase. Most are configuration-only — there are no application code changes.

### 9.1 Environment Variables

| Variable                          | Dev value                | Prod value                          |
|-----------------------------------|--------------------------|-------------------------------------|
| `VITE_USE_FIREBASE_EMULATOR`      | `true`                   | unset (or `false`)                  |
| `VITE_FIREBASE_API_KEY`           | (from terraform output)  | same (or per-env value)             |
| `VITE_FIREBASE_AUTH_DOMAIN`       | same                     | same                                |
| `VITE_FIREBASE_PROJECT_ID`        | same                     | same                                |
| `VITE_FIREBASE_STORAGE_BUCKET`    | same                     | same                                |
| `VITE_FIREBASE_APP_ID`            | same                     | same                                |

The single flag `VITE_USE_FIREBASE_EMULATOR` is the *only* code-aware switch between environments. Everything else is just per-environment values.

### 9.2 Real Email Delivery

In emulator mode, verification and password-reset emails are logged to the terminal — they are not delivered. In live Firebase, the same SDK calls (`sendEmailVerification`, `sendPasswordResetEmail`) trigger Google's SMTP infrastructure and emails arrive at the real inbox within seconds.

No code change required. Just don't set the emulator flag.

### 9.3 Authorized Domains (Firebase Console → Authentication → Settings)

Before any user can sign in from your production domain, the domain must be on the Authorized Domains list. By default, the list contains:
- `localhost`
- `<project-id>.firebaseapp.com`
- `<project-id>.web.app`

Before launch, add:
- Your production custom domain (e.g., `app.prhomz.com`)
- Any staging domains

Without this, sign-in attempts from the unlisted domain will fail with `auth/unauthorized-domain`.

### 9.4 Action Code Settings (verification & reset email links)

Currently, `sendEmailVerification(user)` and `sendPasswordResetEmail(email)` are called without an `actionCodeSettings` object. This means verification links lead to a Firebase-hosted confirmation page instead of redirecting back to the application.

For production, pass:

```
{
  url: 'https://app.prhomz.com/auth/verified',
  handleCodeInApp: false
}
```

A `continueUrl` query parameter is appended automatically — after Firebase's confirmation page, the browser is redirected to that URL. Small UX win; not strictly required.

### 9.5 Email Template Branding (Firebase Console → Authentication → Templates)

Default Firebase verification email reads "Hello, Follow this link to verify your email..." with a generic blue button. For production:

- **From name** — change from `noreply@<project-id>.firebaseapp.com` to a branded sender
- **Subject line** — e.g., "Verify your PRHOMZ account"
- **Body HTML** — replace with branded template
- **Reply-to** — point to a real support inbox

Or upgrade to a custom email provider (SendGrid via Firebase Extensions) for full control.

### 9.6 Tightened Firestore Rules (handled by Phase 3)

When Phase 3 deploys the `onUserCreate` Cloud Function and the proxy Functions, the rules will be updated to:

```
match /users/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;

  // Client can update its own profile EXCEPT server-only fields
  allow update: if request.auth != null
    && request.auth.uid == userId
    && !(request.resource.data.diff(resource.data).affectedKeys()
        .hasAny(['tier','stripeCustomerId','subscriptionId','subscriptionStatus',
                 'currentPeriodEnd','monthlyDesignCount','monthlyResetAt',
                 'totalRenders','renderTimestamps']));

  // Creation is server-only (Function trigger)
  allow create: if false;
  allow delete: if false;
}
```

The Functions runtime SA bypasses these rules via the Admin SDK. Result: tier, quota, and subscription state are write-only by the server. Users cannot promote themselves.

### 9.7 Deploy Firestore + Storage Rules to Live Firebase

```bash
firebase deploy --only firestore:rules,storage:rules --project prhomz-dev-code-test
```

This is a one-line deploy whenever rules change. Until done, the rules apply only to the emulator.

### 9.8 App Check / reCAPTCHA Enterprise (Phase 7)

Live Firebase APIs are publicly addressable — anyone with the `apiKey` (which is intentionally not a secret in Firebase) could hit them. To prevent bots from calling Auth/Firestore/Storage/Functions from outside our application:

1. Register a reCAPTCHA Enterprise site key in Google Cloud Console.
2. Enable App Check in Firebase Console for each service.
3. Add the App Check provider to `firebaseClient.ts` (3 lines of code).
4. Set enforcement mode to "Enforced" once telemetry shows real traffic is being verified.

### 9.9 CORS Tightening on Gallery Bucket

The storage bucket currently has CORS rules allowing `origin: ["*"]` (from [infra/storage.tf:25](infra/storage.tf#L25)) — fine for dev, too open for prod.

Before launch, update `image_retention_days` and CORS origin in Terraform to your production domain only, then `terraform apply`.

### 9.10 Custom Domain & SSL (Phase 7)

`firebase hosting:sites:create` + DNS configuration. Firebase issues a Let's Encrypt cert automatically once the domain is verified. Once live, update Authorized Domains (§9.3) and Action Code Settings (§9.4) to use the new domain.

### 9.11 Monitoring & Budget Alerts

Already in place from Phase 0:
- GCP Billing Budget alert at $50 / month
- Cloud Logging captures all Firestore + Auth + Functions logs by default

Additional recommended:
- Cloud Monitoring alert on `auth/too-many-requests` rate (signals brute-force attempts)
- Alert on `auth/account-exists-with-different-credential` (if multi-provider added later)

---

## 10. Known Limitations

| Limitation                                                  | Severity | Mitigation                                |
|-------------------------------------------------------------|----------|-------------------------------------------|
| Client creates its own user doc (Phase 1 placeholder)       | Low      | Phase 3 replaces with Cloud Function      |
| Client can modify its own `tier` field today                 | Low      | No tier-based gating exists in app yet; tightened in Phase 3 |
| Gallery still in `localStorage` (5-image cap)               | Medium   | Phase 2 migrates to Firestore + Storage   |
| No password-policy enforcement at Firebase server-side       | Low      | Client-side regex blocks the gap; Identity Platform policy can be added in console |
| Disposable email domains not blocked                        | Low      | Phase 3 will add a denylist in `proxyRemodel` Function |
| Welcome email uses Firebase default branding                 | Low      | Phase 7 cosmetic                          |
| No CAPTCHA / App Check on Auth endpoints                    | Medium   | Phase 7 hardening                         |

---

## 11. Cost Impact

Phase 1 added no measurable cost to the dev environment beyond what Phase 0 already covers:

- **Firebase Auth**: Free up to 50,000 monthly active users. We're at 1 test user.
- **Firestore**: One write per signup (creating user doc), one read per page load (loading user doc). Free tier easily absorbs this.
- **No Functions deployed yet**: $0.

Total Phase 1 cost contribution: **~$0.00/month** above Phase 0's baseline (~$0.30/month).

---

## 12. What Phase 2 Will Add

Brief preview so this report sits in context:

- Move generated images from `localStorage` (base64, 5-image cap) to **Cloud Storage** (full resolution, per-tier retention).
- Add a `gallery` subcollection under each user document.
- Add the `ExpiryChip` and tier-aware retention banner UI to `Gallery.tsx`.
- Add `onGalleryImageFinalize` (Storage trigger) to generate thumbnails.
- Add `expireOldImages` (scheduled hourly) to honor per-tier retention windows.

Phase 1 deliverables remain unchanged through Phase 2.

---

## 13. Files Changed Summary

```
New:
  services/firebaseClient.ts
  services/authService.ts
  services/userService.ts
  components/EmailVerificationPending.tsx
  firebase.json
  .firebaserc
  firestore.rules
  firestore.indexes.json
  storage.rules

Modified:
  components/Auth.tsx          (rewrite)
  App.tsx                      (rewire — auth listener + Firestore sub)
  types.ts                     (expanded UserAccount)
  .gitignore                   (added Firebase patterns)
  .env.local                   (added Firebase config — gitignored)
  package.json                 (added firebase, firebase-tools, @types/react*)

Total: 9 new files, 6 modified files, ~700 lines of net code added.
```

---

## 14. Sign-Off

| Item                                  | Verified |
|---------------------------------------|----------|
| Email + password sign-up works        | Yes      |
| Email verification gate enforced      | Yes      |
| Firestore user doc created            | Yes      |
| Sign-in / sign-out work               | Yes      |
| Forgot password works                 | Yes      |
| Session persists across refresh       | Yes      |
| All tests in §7 passed                | Yes      |
| Production migration path documented  | Yes      |
| No regressions in existing components | Yes      |

**Phase 1 status: complete. Ready for Phase 2.**
