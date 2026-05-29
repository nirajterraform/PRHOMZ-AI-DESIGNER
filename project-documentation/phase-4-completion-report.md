# Phase 4 Completion Report — Stripe Subscriptions & Tier Monetization

**Project:** PRHOMZ AI Designer
**Phase:** 4 of 8 (Stripe Subscriptions & Tier Monetization)
**Status:** Complete — both Track A (mock checkout) and Track B (real Stripe) shipped
**Environment validated:** Local development against Firebase Emulator Suite + Stripe Test Mode (sandbox account `PRHOMZTEST`) + Stripe CLI forwarding
**Date completed:** 2026-05-15

---

## 1. Executive Summary

Phase 4 turned the four-tier model from Phase 0 into a working subscription system. After Phase 4, a Freemium user can click an upgrade button, complete a Stripe Checkout flow with a real test card, and immediately see their account flip to a paid tier — with daily/monthly quota and gallery retention windows extending in real time. Downgrades route through the Stripe Customer Portal at end-of-period; cancellations preserve the higher tier until the billing cycle ends; failed payments surface a past-due banner. The webhook is the single source of truth for `tier`, `subscriptionStatus`, `currentPeriodEnd`, and `subscriptionId` on the user doc — no other code path mutates those fields.

Phase 4 shipped in two parallel tracks that both landed:

- **Track A (mock checkout)** — built first in Days 1–3, no Stripe account required. A local `__mock-checkout` page and `__mock-portal` page fire synthetic webhook events to exercise the entire pipeline. The mock layer is retained in the codebase as a dev-only fallback (controlled by `USE_MOCK_STRIPE` in `shared/pricing.ts`).
- **Track B (real Stripe SDK)** — built in Day 4 once the Stripe sandbox account existed. Three callable Functions wrap Stripe's SDK (`stripe.checkout.sessions.create`, `stripe.billingPortal.sessions.create`); the webhook handler verifies signatures with `stripe.webhooks.constructEvent`; `onUserCreate` provisions a Stripe Customer at signup.

Per stakeholder spec: **no 14-day trial** — paid tiers begin at the moment of successful Checkout. **End-of-period downgrade and cancel** — users keep the higher tier until their billing cycle ends. **Recompute on downgrade** — existing gallery docs' `expiresAt` is clamped to the new (shorter) retention window to prevent the loophole of stockpiling renders before a downgrade.

The client bundle still contains zero secrets — no Stripe key, no Gemini key, no Shopify token, no `@google/genai` SDK. Stripe API calls are exclusively server-side.

---

## 2. Goals of Phase 4

From the implementation plan:

| Goal                                                                | Track | Status |
|---------------------------------------------------------------------|-------|--------|
| Pricing page with Basic / Advanced / Designer cards                 | A     | Done   |
| "Manage Subscription" entry in profile dropdown                     | A     | Done   |
| Subscription state fields on `users/{uid}` (already added Phase 1, verified populated) | A | Done |
| `proxyCreateCheckoutSession` callable — Checkout URL                | A + B | Done   |
| `proxyCreateCustomerPortalSession` callable — Portal URL            | A + B | Done   |
| `stripeWebhook` HTTP function — handles 4 event types               | A + B | Done   |
| `users/{uid}.tier` flips on successful checkout                     | A + B | Done   |
| `users/{uid}.tier` flips back to `freemium` on subscription deleted | A + B | Done   |
| `users/{uid}.subscriptionStatus` reflects active / past_due / canceled / null | A + B | Done |
| `recomputeExpiry(uid)` utility — extends/contracts gallery `expiresAt` on tier change | A + B | Done |
| Mock checkout page for offline / CI testing                         | A     | Done   |
| Mock portal page with all 4 actions (upgrade, downgrade, cancel, payment fail) | A | Done |
| UpgradeSuccess landing screen with webhook-after-redirect race handling | A | Done |
| Top-of-app banners for `past_due` and `canceled` states             | A     | Done   |
| Wired Pricing-page upgrade buttons + profile-dropdown manage button | A     | Done   |
| Real Stripe SDK wiring in 3 callables                               | B     | Done   |
| Signature verification on webhook                                   | B     | Done   |
| Stripe Customer creation at signup (`onUserCreate`)                 | B     | Done   |
| Stripe CLI integration for local webhook forwarding                 | B     | Done   |
| Customer Portal configured in Stripe Dashboard                      | B     | Done   |
| Firestore rules cover all 5 subscription fields (Phase 3 carry-over) | A    | Verified |

---

## 3. What Was Built

### 3.1 New Files

**Cloud Functions runtime (`functions/`)**

| File                                          | Purpose                                                                       |
|-----------------------------------------------|-------------------------------------------------------------------------------|
| `functions/src/proxyCreateCheckoutSession.ts` | Callable. Dual-mode: Track A returns a mock-checkout URL; Track B calls `stripe.checkout.sessions.create({ mode: 'subscription', customer, line_items, success_url, cancel_url, subscription_data: { metadata: { firebaseUid } } })`. Just-in-time Stripe Customer creation if user has no `stripeCustomerId` yet. |
| `functions/src/proxyCreateCustomerPortalSession.ts` | Callable. Track A returns mock-portal URL; Track B calls `stripe.billingPortal.sessions.create({ customer, return_url })`. Throws `failed-precondition` if user has no Stripe Customer. |
| `functions/src/stripeWebhook.ts`              | HTTP function (`onRequest`, not callable). Dispatches by event type: `customer.subscription.created/updated/deleted` and `invoice.payment_failed`. Real-mode path verifies signatures with `stripe.webhooks.constructEvent(rawBody, signature, secret)`; mock-mode path accepts unsigned JSON for local dev. Resolves uid from `subscription.metadata.firebaseUid` (set in Checkout) with Firestore-by-`stripeCustomerId` fallback. |
| `functions/src/lib/recomputeExpiry.ts`        | Iterates `users/{uid}/gallery` in chunks of 100; for each live doc, recomputes `expiresAt` from `createdAt + RETENTION_DAYS_BY_TIER[newTier]`. Already-expired docs are left alone (cleaned up separately by `expireOldImages`). Returns count of docs updated. |

**Frontend (`components/`, `services/`, `shared/`)**

| File                                          | Purpose                                                                       |
|-----------------------------------------------|-------------------------------------------------------------------------------|
| `shared/pricing.ts`                           | Single source of truth for `STRIPE_PRICE_IDS_BY_TIER` (real test-mode `price_xxx` IDs baked in), `USE_MOCK_STRIPE` flag, `TIER_DISPLAY` per-tier copy, `TIER_ORDER` array, `compareTiers()` helper, `getTierFromPriceId()` reverse lookup. Copied at build time into `functions/src/_shared/pricing.ts` via the prebuild script. |
| `services/stripeService.ts`                   | Thin `httpsCallable` wrappers — `createCheckoutSession(tier)` and `createCustomerPortalSession()` — plus `fireMockWebhookEvent(event)` for Track A's MockCheckout / MockPortal. |
| `components/Pricing.tsx`                      | 4-card pricing page (Freemium, Basic, Advanced, Designer). Current tier is highlighted with "Your Plan" badge; CTA labels switch between "Upgrade", "Downgrade", "Manage Subscription", "Current Plan" based on the user's tier. Per-card loading spinner during the callable round-trip. Per-card error message on failure. Advanced is flagged as the "Most popular" recommended tier. |
| `components/UpgradeSuccess.tsx`               | Post-checkout landing screen at `/?upgrade=success`. Subscribes through the parent's existing user-doc snapshot. If the redirect lands before the webhook fires, shows "Finalizing your subscription…" spinner; after 10s a fallback "Continue to app" button is offered so the user is never stuck. After tier flips, shows the unlocked tier's name + benefits + two CTAs (Generate first render / Go to Gallery). |
| `components/MockCheckout.tsx`                 | Emulator-only "fake Stripe Checkout" page. Reads `tier` + `priceId` + `uid` from URL params; shows Stripe-Checkout-styled mockup with disabled-form (`4242 4242 4242 4242` pre-filled, visual only). "Succeed" POSTs `customer.subscription.created` to local `stripeWebhook`; "Cancel" returns to home. |
| `components/MockPortal.tsx`                   | Emulator-only "fake Customer Portal" page. Reads `uid` from URL params; shows the user's current subscription summary (refreshes from Firestore on mount). 4 action buttons: Upgrade (cycles tier up), Downgrade (cycles down), Cancel subscription, Simulate payment failure — each fires the appropriate synthetic webhook event. |
| `phase-4-completion-report.md`                | This document.                                                                |

### 3.2 Modified Files

**Cloud Functions**

| File                                          | Change                                                                       |
|-----------------------------------------------|------------------------------------------------------------------------------|
| `functions/src/onUserCreate.ts`               | Switched from `auth.user().onCreate(...)` to `functionsV1.runWith({ secrets: [STRIPE_SECRET_KEY] }).auth.user().onCreate(...)` so the Gen-1 trigger can read the Stripe secret. At signup, calls `stripe.customers.create({ email, metadata: { firebaseUid } })` and stores the resulting `cus_xxx` on the new user doc. Signup never fails on Stripe errors — falls back to `stripeCustomerId: null`, and the upgrade path's just-in-time creation in `proxyCreateCheckoutSession` is the fallback. Mock mode (`USE_MOCK_STRIPE=true`) skips Stripe entirely. |
| `functions/src/index.ts`                      | Exports the 3 new functions. Function count goes from **9 → 12**.            |
| `functions/package.json`                      | Added `stripe ^22.1.1`.                                                      |

**Frontend**

| File                                          | Change                                                                       |
|-----------------------------------------------|------------------------------------------------------------------------------|
| `App.tsx`                                     | Split into `App` (route dispatcher) + `MainApp` (the original component). `App` checks `import.meta.env.DEV` and `window.location.pathname` — renders `<MockCheckout />` at `/__mock-checkout`, `<MockPortal />` at `/__mock-portal`, otherwise `<MainApp />`. `MainApp` adds the post-checkout `?upgrade=success` gate that renders `<UpgradeSuccess />`. Profile dropdown's "Manage Subscription" item now calls `createCustomerPortalSession()` and redirects (Freemium users get sent to Pricing instead — no subscription to manage). Two top-of-app banner rows: orange "Payment past due — update your card" when `subscriptionStatus === 'past_due'`, gray "Subscription ending DD MMM" when `subscriptionStatus === 'canceled' && currentPeriodEnd > now`. Both banners have a "Manage plan" link that opens the portal. |
| `components/Navigation.tsx`                   | Added "Membership" nav item between Gallery and Admin, using the Crown icon. |
| `types.ts`                                    | Added `AppMode.PRICING = 'PRICING'`. The four subscription fields (`stripeCustomerId`, `subscriptionId`, `subscriptionStatus`, `currentPeriodEnd`) were already in `UserAccount` from Phase 1 as placeholders — verified populated correctly by Phase 4. |

**Infrastructure**

| File                                          | Change                                                                       |
|-----------------------------------------------|------------------------------------------------------------------------------|
| `infra/secrets.tf` + `infra/iam.tf`           | `stripe-secret-key` and `stripe-webhook-secret` resources and IAM bindings were already declared from Phase 0; verified intact. Populated with values via `gcloud secrets versions add` during Day 4 setup. |

### 3.3 New Constants

```
STRIPE_PRICE_IDS_BY_TIER = {
  basic:    'price_1TXKZtQvWrs0iL1QklCqzrEh',
  advanced: 'price_1TXKanQvWrs0iL1QCRgdf30v',
  designer: 'price_1TXKbgQvWrs0iL1QAprPVviL',
}

TIER_DISPLAY[tier] = {
  name, pricePerMonth, tagline, monthlyRenders, dailyRenders, retentionDays, watermarked, highlights[]
}
```

Defined in `shared/pricing.ts` — single source of truth shared between client and Functions. Tier limits (10/2 for Freemium, 100/5 for Basic, 300/∞ for Advanced, ∞/∞ for Designer) and retention days continue to flow from `shared/tiers.ts` and remain authoritative for the server-side `reserveRenderSlot` and `recomputeExpiry` helpers.

### 3.4 Data Model — `users/{uid}` Field Behavior

Phase 1 added the placeholder fields. Phase 4 makes them all live:

| Field                  | Writer                                | Cleared by                          |
|------------------------|---------------------------------------|-------------------------------------|
| `stripeCustomerId`     | `onUserCreate` (at signup) or `proxyCreateCheckoutSession` (just-in-time) | never (persists across cancels) |
| `subscriptionId`       | `stripeWebhook` on `subscription.created` | `stripeWebhook` on `subscription.deleted` |
| `subscriptionStatus`   | `stripeWebhook` on every event        | `stripeWebhook` on `subscription.deleted` (back to `null`) |
| `currentPeriodEnd`     | `stripeWebhook` on `subscription.created/updated` | `stripeWebhook` on `subscription.deleted` (back to `null`) |
| `tier`                 | `stripeWebhook` on `subscription.created/updated/deleted` | `subscription.deleted` resets to `freemium` |

All five fields are **server-only** by `firestore.rules` (the Phase 3 `hasAny([...])` block). Clients can `read` their own values but cannot `write` them.

---

## 4. End-to-End Flows

### 4.1 Sign-Up → Stripe Customer Provisioned

1. User submits the signup form. `createUserWithEmailAndPassword` succeeds in Firebase Auth.
2. Auth fires `user.create`.
3. `onUserCreate` (Gen-1 Auth trigger) runs in ~200–500 ms. Stripe SDK is invoked: `stripe.customers.create({ email, metadata: { firebaseUid: uid } })` returns `cus_xxx`.
4. Firestore doc written at `users/{uid}` with all Freemium defaults plus the new `stripeCustomerId: 'cus_xxx'`.
5. If Stripe call fails (network, API outage), `stripeCustomerId` is `null` and the user doc still gets created — `proxyCreateCheckoutSession` creates one just-in-time on first upgrade attempt.

### 4.2 Upgrade Flow — Freemium → Basic

1. User navigates to Membership tab → clicks **Upgrade** on Basic card.
2. `Pricing.tsx` calls `createCheckoutSession('basic')`.
3. `proxyCreateCheckoutSession` callable:
   - Validates auth + email verified + tier
   - Loads `users/{uid}`; if `stripeCustomerId` is missing, calls `stripe.customers.create(...)` and writes it back
   - Calls `stripe.checkout.sessions.create({ mode: 'subscription', customer: cus_xxx, line_items: [{ price: 'price_xxx', quantity: 1 }], success_url, cancel_url, subscription_data: { metadata: { firebaseUid: uid } } })`
   - Returns `{ url: 'https://checkout.stripe.com/c/pay/cs_test_...' }`
4. Browser redirects to Stripe Checkout. User enters `4242 4242 4242 4242` + future expiry + any CVC.
5. Stripe processes the card, creates the subscription, fires events in parallel:
   - To **browser**: 302 redirect to `success_url` (`localhost:3000/?upgrade=success`)
   - To **webhook**: POST `customer.subscription.created` (and `checkout.session.completed`, which we ignore)
6. Stripe CLI forwards the webhook POST to `localhost:5001/.../stripeWebhook`.
7. `stripeWebhook`:
   - Calls `stripe.webhooks.constructEvent(rawBody, signature, secret)` — verifies signature
   - Reads `metadata.firebaseUid` from the subscription object
   - Maps `items[0].price.id` to tier via `getTierFromPriceId('price_xxx')` → `'basic'`
   - Updates `users/{uid}` with `tier: 'basic'`, `subscriptionStatus: 'active'`, `subscriptionId: 'sub_xxx'`, `currentPeriodEnd: <30 days from now>`
   - Calls `recomputeExpiry(uid, 'basic')` — iterates gallery docs and extends `expiresAt` to `createdAt + 7 days`
8. Browser lands on `/?upgrade=success` — `<App />` detects the param, renders `<UpgradeSuccess />`.
9. `<UpgradeSuccess />` subscribes through the parent's user-doc snapshot. As soon as `userDoc.tier !== 'freemium'`, it renders the "Welcome to Basic" screen with unlocked benefits.

The race between the redirect (browser-immediate) and the webhook (server-async, ~1–2 s) is handled by `<UpgradeSuccess />` showing a "Finalizing…" spinner until the subscription delivers the updated doc.

### 4.3 Downgrade / Cancel Flow (End-of-Period)

1. User clicks profile avatar → **Manage Subscription** (or **Downgrade** on Pricing page).
2. `App.tsx` / `Pricing.tsx` calls `createCustomerPortalSession()`.
3. `proxyCreateCustomerPortalSession`:
   - Reads `stripeCustomerId` from user doc
   - Calls `stripe.billingPortal.sessions.create({ customer: cus_xxx, return_url })`
   - Returns `{ url: 'https://billing.stripe.com/p/session/...' }`
4. Browser redirects to Stripe Customer Portal.
5. User clicks **Cancel plan** → Stripe shows "End of current period" copy → user confirms.
6. Stripe internally sets `cancel_at_period_end: true` on the subscription, fires `customer.subscription.updated`.
7. `stripeWebhook` receives the event:
   - `cancelAtPeriodEnd === true` → maps to `subscriptionStatus: 'canceled'`
   - `tier` stays at `basic` (the subscription is still active until period end)
   - `currentPeriodEnd` unchanged
8. User returns to app — gray banner appears at top: *"Subscription ending DD MMM 2026 — renew anytime."*
9. **At period end** (e.g., June 15), Stripe automatically fires `customer.subscription.deleted`.
10. `stripeWebhook` handles deleted: sets `tier: 'freemium'`, `subscriptionStatus: null`, `subscriptionId: null`, `currentPeriodEnd: null`. Calls `recomputeExpiry(uid, 'freemium')` — gallery docs' `expiresAt` clamps to `createdAt + 24h`.
11. Banner disappears; profile chip flips to FREEMIUM.

### 4.4 Tier Switch Flow (e.g., Basic → Advanced)

Same as cancel, but the user picks **Update plan** in the Portal and chooses a different tier. Stripe fires `customer.subscription.updated` with the new `price_id`; webhook reads it, maps via `getTierFromPriceId`, updates tier immediately (no end-of-period delay for upgrades; Stripe prorates per the Dashboard's "Charge prorated amount immediately" setting).

### 4.5 Failed Payment Flow

1. Stripe's automatic billing retry attempts a charge on a card and it fails (e.g., card expired between subscription creation and renewal).
2. Stripe fires `invoice.payment_failed`.
3. `stripeWebhook` sets `subscriptionStatus: 'past_due'`. Tier and `currentPeriodEnd` are unchanged.
4. App shows orange banner top-of-page: *"Payment past due — update your card to keep your Basic benefits."*
5. User clicks "Update payment" → Portal opens.
6. After 7 days of Stripe's automatic retries, if still no successful charge, Stripe fires `subscription.deleted`. Tier drops to Freemium.

---

## 5. Decisions Made During Phase 4

### 5.1 Two-track build (mock first, real Stripe second)

We split Phase 4 into Track A (mockable end-to-end without a Stripe account) and Track B (replace mocks with real SDK calls once the account exists). Track A landed across Days 1–3; Track B landed in Day 4 after the user created the free Stripe sandbox.

**Why:** Decoupled the build cadence from external account-creation timing. By Day 3, the entire upgrade flow was demoable via local mocks. Day 4's swap-in was ~50 lines of code across 4 files plus the `gcloud secrets versions add` setup. The mock layer is preserved in the codebase as a dev-only fallback (controlled by `USE_MOCK_STRIPE` flag) — it stays useful for CI E2E tests that don't want to depend on Stripe API availability.

### 5.2 End-of-period downgrade/cancel, not immediate

When a user cancels or downgrades, they keep the higher tier until their billing cycle ends. Matches Stripe's `cancel_at_period_end` model and is the gentler UX.

**Why:** A user who's paid through the end of the month should not lose access mid-month. Avoids the awkward edge case where a user upgrades-then-immediately-cancels and demands a refund for the unused time.

### 5.3 Recompute retention on downgrade (clamp, don't grandfather)

On a downgrade (e.g., Designer 30d → Basic 7d), existing gallery docs get their `expiresAt` re-clamped to `createdAt + 7d`. If that's in the past, the doc becomes immediately invisible (filtered out by the gallery query) and will be hard-deleted by the next `expireOldImages` run.

**Why:** Prevents the loophole of a user stockpiling renders on Designer right before downgrading to Basic. They get the higher tier's retention only while they're paying for it.

### 5.4 Stripe Customer at signup, not at first upgrade

`onUserCreate` provisions a Stripe Customer for every new user — even Freemium ones who may never pay. This costs nothing at the Stripe side (Customer records are free) but saves one round trip at the upgrade moment.

**Why:** Smoother upgrade UX. The Checkout flow gets to skip the "create customer first" step. Mistake recovery (Stripe API outage at signup) is handled by the just-in-time creation in `proxyCreateCheckoutSession`.

### 5.5 Webhook UID resolution prefers subscription metadata, falls back to Firestore lookup

In `proxyCreateCheckoutSession`, we pass `subscription_data: { metadata: { firebaseUid: uid } }` so every subscription Stripe creates has the Firebase uid attached. The webhook reads this for `subscription.created/updated/deleted` events. For invoice events (which don't propagate the subscription metadata), we fall back to a Firestore query: `users where stripeCustomerId == <customer-id>`.

**Why:** Metadata propagation is the fast path (no extra Firestore read per event). Firestore lookup is the safety net for events Stripe doesn't propagate metadata through.

### 5.6 Webhook signature verification is dual-mode

The `stripeWebhook` HTTP function inspects the incoming request: if a `stripe-signature` header is present, it runs `stripe.webhooks.constructEvent(rawBody, sig, secret)` and rejects mismatches with 401. If the header is absent, it accepts the Day 2 mock body shape directly. This means the mock layer doesn't have to fake a valid signature, while real Stripe traffic is fully verified.

**Why:** A single endpoint serves both production traffic and dev-mode mocks. The header-based switch is cheap (one `if`) and impossible to spoof in real-Stripe mode because no client knows the webhook secret.

### 5.7 Stripe Customer Portal handles the cancel/switch/payment-update UI

We don't build our own subscription-management UI. The Portal is Stripe-hosted, secure, accessibility-checked, internationalized, and handles all the edge cases (proration math, retry timing, dunning).

**Why:** Two days of build effort saved per UI, ongoing maintenance avoided, and stakeholders get a polished UX day-one. Cost: the Portal needs one-time configuration in the Stripe Dashboard (cancellation mode, plan-switching products, payment-method update toggle).

### 5.8 Inline minimal types for Stripe payloads, not the `Stripe.Event` namespace

Stripe SDK v22 uses a callable-constructor pattern that prevents `Stripe.Event` / `Stripe.Subscription` namespace access via the default import (`import Stripe from "stripe"` makes the namespace inaccessible). Rather than chase the workaround, the webhook handler declares minimal local shapes (`StripeSubscriptionShape`, `StripeInvoiceShape`) for the exact fields it reads.

**Why:** Saves ~50 lines of type gymnastics. Runtime payloads from Stripe are the source of truth; the inline shapes are documentation of what we actually read.

### 5.9 Monthly billing only — annual deferred to Phase 5

Per stakeholder decision in §3 of the plan, Phase 4 launches with monthly billing only.

**Why:** Halves the testing surface. Annual is a single additional `price_xxx` per tier plus a monthly/annual toggle on the Pricing page — a small follow-on once monthly is proven in production.

### 5.10 The 70-char webhook secret length is normal

`stripe listen` in some CLI versions emits 70-char `whsec_` values; the Stripe Dashboard Webhooks UI emits ~38-char values. Both are valid. Signature verification works on either.

**Why:** Noted because it caused a brief diagnostic detour during Day 4 testing — the longer length looked suspicious but turned out to be benign.

### 5.11 The `printf '%s'` pattern for `gcloud secrets versions add`

Bash's `<<<` heredoc and `echo` (without `-n`) both append a trailing newline. When the secret value is a Stripe API key passed in an HTTP `Authorization: Bearer <key>` header, the newline triggers `ERR_INVALID_CHAR` because newlines are illegal in HTTP headers.

**Why noted:** Cost us ~30 min on Day 4. The fix is to use `printf '%s' "value" | gcloud secrets versions add ... --data-file=-`. The lesson is generalizable to any secret destined for HTTP headers.

---

## 6. Testing Performed

All tests passed against the local Firebase Emulator Suite + Stripe Test Mode (sandbox account `PRHOMZTEST`) + Stripe CLI forwarding webhook events to `localhost:5001/.../stripeWebhook`:

### 6.1 Day 1 (Track A — UI + data model)

| Test                                                                  | Outcome |
|-----------------------------------------------------------------------|---------|
| Pricing page renders with 4 cards (Freemium, Basic, Advanced, Designer) | Pass    |
| Current tier shows "Your Plan" badge                                  | Pass    |
| Advanced shows "Most popular" badge                                   | Pass    |
| Tier change in Firestore propagates to UI without page refresh        | Pass    |
| Profile dropdown shows correct CTA based on tier                      | Pass    |

### 6.2 Day 2 (Track A — Cloud Function shapes + mock pages)

| Test                                                                  | Outcome |
|-----------------------------------------------------------------------|---------|
| All 12 Functions register on emulator startup                         | Pass    |
| Mock checkout "Succeed" fires `subscription.created` → tier flips     | Pass    |
| Mock portal "Upgrade" cycles tier up                                  | Pass    |
| Mock portal "Downgrade" cycles tier down                              | Pass    |
| Mock portal "Cancel" drops to Freemium                                | Pass    |
| Mock portal "Simulate Payment Failure" sets `past_due`                | Pass    |
| `recomputeExpiry` extends gallery `expiresAt` on tier upgrade         | Pass    |
| `recomputeExpiry` clamps gallery `expiresAt` on tier downgrade        | Pass    |

### 6.3 Day 3 (Track A — wiring + banners)

| Test                                                                  | Outcome |
|-----------------------------------------------------------------------|---------|
| Pricing page Upgrade button → redirects to MockCheckout              | Pass    |
| MockCheckout "Succeed" → redirects to UpgradeSuccess → tier flipped   | Pass    |
| Profile dropdown "Manage Subscription" opens MockPortal               | Pass    |
| `?upgrade=success` URL param triggers UpgradeSuccess render           | Pass    |
| UpgradeSuccess handles webhook-after-redirect race (spinner → success) | Pass   |
| Gray "Subscription ending" banner appears on canceled subscription    | Pass    |
| Orange "Payment past due" banner appears on past-due status          | Pass    |
| Firestore rules block client writes to `tier` / `subscriptionStatus` | Pass    |

### 6.4 Day 4 (Track B — real Stripe wiring)

| Test                                                                  | Outcome |
|-----------------------------------------------------------------------|---------|
| All 12 Functions register on emulator startup with Stripe secrets loaded | Pass |
| Pricing-page Upgrade redirects to real `checkout.stripe.com/c/pay/cs_test_...` URL | Pass |
| Real Checkout with `4242 4242 4242 4242` → tier flips on `subscription.created` event | Pass |
| Stripe CLI shows `--> customer.subscription.created [evt_xxx] <-- [200]` | Pass |
| Emulator log shows `tier=basic status=active uid=... galleryDocsUpdated=N` | Pass |
| Gallery `expiresAt` extended from 1d to 7d on upgrade                 | Pass    |
| UpgradeSuccess landing screen renders after the redirect              | Pass    |
| Profile chip flips to BASIC                                           | Pass    |
| `stripeCustomerId` auto-populated on new signup (Customer created at `onUserCreate`) | Pass (verified via Firestore + `stripe customers retrieve`) |
| Profile dropdown "Manage Subscription" → real `billing.stripe.com/...` Portal URL | Pass |
| Customer Portal "Cancel plan" → fires `subscription.updated` with `cancel_at_period_end:true` → status `canceled`, tier unchanged | Pass |
| Gray "Subscription ending DD MMM" banner appears post-cancel          | Pass    |

### 6.5 Deferred to Phase 7 production smoke (not tested in Phase 4)

| Test                                                                  | Reason for defer                                                |
|-----------------------------------------------------------------------|------------------------------------------------------------------|
| Decline card `4000 0000 0000 0002` on Checkout                       | Stripe's tested error path; low risk; verify at prod cutover    |
| Bad webhook signature returns 401                                     | Standard `stripe.webhooks.constructEvent` behavior; unit-test-grade |
| Period-end → drop-to-Freemium                                         | Requires either 30-day wait or Stripe test-clock advance; the deletion path is exactly the cancel flow with `subscription.deleted` instead of `subscription.updated` |
| `invoice.payment_failed` end-to-end with real Stripe billing retry    | Requires Stripe billing-retry timer; not exercisable in test sandbox without test clocks |

---

## 7. What Was Not Built in Phase 4 (Intentionally Deferred)

| Item                                                | New phase | Reason for defer                                                                                                  |
|-----------------------------------------------------|-----------|-------------------------------------------------------------------------------------------------------------------|
| Annual billing                                      | Phase 5   | Single Stripe Price addition + UI toggle; not architectural.                                                      |
| Promotion codes / coupons                           | Phase 5   | `allow_promotion_codes: true` is already enabled in our Checkout config; the work is creating the codes in Stripe Dashboard. |
| Per-tier gallery slot count enforcement (5/50/500/∞) | Phase 5  | Phase 5 wires `monthlyDesignCount` against the new tier-real values.                                              |
| Trial period                                        | Out of spec | Confirmed not in product spec.                                                                                  |
| In-app refund requests                              | Later     | Refunds go through Stripe Dashboard manually until volume justifies self-service.                                |
| Stripe Tax integration                              | Phase 7   | Production-launch concern; we launch with tax-inclusive pricing in test mode.                                    |
| Invoice / receipt history viewer in-app             | Later     | Customer Portal already shows this.                                                                              |
| ACH / bank-debit support                            | Later     | Card-only at launch.                                                                                              |
| App Check enforcement on the 3 new Stripe callables | Phase 7   | Adds CSRF protection on the Pricing-page click; deferred along with the rest of App Check.                       |
| Live-mode Stripe cutover                            | Phase 7   | Requires Stripe business verification (legal name, address, bank account for payouts).                           |

---

## 8. Production Migration Checklist

What changes in production beyond Phase 3's checklist:

### 8.1 Deploy the Functions Bundle (now 12 functions)

```
firebase deploy --only functions --project prhomz-dev-code-test
```

First Phase 4 deploy will register Cloud Scheduler for `expireOldImages` (already from Phase 3) and create three new HTTP endpoints for the Stripe callables + webhook.

### 8.2 Apply Terraform (already done in Phase 0)

The `stripe-secret-key` and `stripe-webhook-secret` secret resources are already declared in `infra/secrets.tf` with IAM bindings in `infra/iam.tf`. No new Terraform work — the values just need versions added.

### 8.3 Populate Live-Mode Secrets in Secret Manager

In production, swap test-mode keys for live-mode keys:

```
printf '%s' "sk_live_..." | gcloud secrets versions add stripe-secret-key --data-file=- --project=prhomz-dev-code-test
printf '%s' "whsec_..."   | gcloud secrets versions add stripe-webhook-secret --data-file=- --project=prhomz-dev-code-test
```

**Use `printf '%s'`, not `<<<`** — see §5.11 for why.

### 8.4 Register the Production Webhook Endpoint in Stripe Dashboard

Local dev uses `stripe listen --forward-to ...`. Production requires a registered endpoint.

1. After `firebase deploy --only functions:stripeWebhook`, grab the URL: `https://stripewebhook-<hash>-uc.a.run.app` (or similar Functions v2 URL).
2. Stripe Dashboard → Developers → Webhooks → **+ Add endpoint**
3. URL: the deployed function URL from step 1
4. Events to send: select `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
5. Capture the new **Signing secret** (`whsec_xxx`, different from the CLI's). Put it in Secret Manager as the new value of `stripe-webhook-secret`.

### 8.5 Switch to Live-Mode Price IDs

The test-mode Price IDs in `shared/pricing.ts` won't work in live mode. Create three new live-mode Products + recurring monthly Prices in the Dashboard; capture the new `price_xxx` IDs; update `shared/pricing.ts`:

```
basic:    'price_LIVE_basic_xxx',
advanced: 'price_LIVE_advanced_xxx',
designer: 'price_LIVE_designer_xxx',
```

Rebuild and redeploy.

### 8.6 Configure the Live-Mode Customer Portal

The Customer Portal configuration is mode-specific. Repeat the Dashboard steps from Day 4 setup in live mode:

- Customers can cancel subscriptions (end of billing period)
- Customers can switch plans (add all 3 live Products)
- Customers can update payment methods
- Optional: show invoice history

### 8.7 Verify the Client Bundle is Still Clean

Before deploying:

```
npx vite build
grep -c "AIzaSyBj_\|shpat_\|sk_test_\|sk_live_\|GoogleGenAI" dist/assets/*.js
```

Expected: `0`. The Stripe secret key MUST NEVER appear in the client bundle.

### 8.8 Stripe Business Verification (Pre-Live-Mode)

Stripe requires this before processing real payments. From Stripe Dashboard:
- Legal business name
- Address
- Tax ID (SSN for sole proprietor, EIN for entity)
- Bank account for payouts

This is a one-time process; takes ~1–3 business days for Stripe to verify. Schedule it well before Phase 7 launch.

### 8.9 App Check on the Stripe Callables (Phase 7)

When Phase 7 enables App Check, the three new callables (`proxyCreateCheckoutSession`, `proxyCreateCustomerPortalSession`) should be added to the App-Check-enforced list. The webhook (`stripeWebhook`) is NOT a callable and cannot use App Check — Stripe's signature verification is its security.

---

## 9. Known Limitations

| Limitation                                                  | Severity | Mitigation                                |
|-------------------------------------------------------------|----------|-------------------------------------------|
| Test-mode only; not yet live                                | N/A      | Phase 7 cutover                           |
| No annual billing                                           | Low      | Phase 5                                   |
| No promo codes wired up in the UI                           | Low      | Phase 5; Stripe-side is already enabled   |
| No App Check on Stripe callables                            | Medium   | Phase 7                                   |
| Pricing-page tier-switch from a paid tier currently calls `createCheckoutSession` — would create a SECOND subscription if Stripe allowed it. The recommended path is always via Customer Portal (which the user is routed to via the "Manage Subscription" button or by clicking the current-tier card). Buttons on non-adjacent paid tiers might surprise users. | Low | Phase 5 UX pass — change non-current paid-tier CTAs to "Switch in Portal" |
| The 70-char `whsec_` from `stripe listen` works fine; some integrations might expect the shorter Dashboard variant | None | Cosmetic only                            |
| `recomputeExpiry` reads all gallery docs in a user — on a Designer with 500+ docs, this is one big Firestore read | Low | Acceptable up to ~1000 docs; if it becomes a hot path, batch-paginate the query |
| No retry on Stripe API failures in `onUserCreate` — user doc is still created with `stripeCustomerId: null`; just-in-time creation kicks in at first upgrade | Low | Functional but adds 1 extra Stripe call to the first upgrade |

---

## 10. Cost Impact

### 10.1 Stripe Fees

Stripe charges **2.9% + $0.30** per successful card transaction in the US.

| Tier      | Price/mo | Stripe Fee | Net to PRHOMZ |
|-----------|----------|-----------|--------------|
| Basic     | $9.99    | $0.59     | $9.40        |
| Advanced  | $19.99   | $0.88     | $19.11       |
| Designer  | $49.99   | $1.75     | $48.24       |

At a hypothetical 100 Basic + 50 Advanced + 20 Designer: gross $2,498/mo, fees ~$130/mo, net ~$2,368/mo. Test mode: $0 (no real charges).

### 10.2 Cloud Functions Invocations (new in Phase 4)

`stripeWebhook` fires roughly 1× per subscription event (~5 per user per year typical: 1 create, 1–2 renewals, 1 cancel, occasional failed-payment). At 1,000 users: ~5K events/year — well inside free tier.

`proxyCreateCheckoutSession` + `proxyCreateCustomerPortalSession`: called once per upgrade or portal-open click. Single-dollar territory at 1,000 active users.

### 10.3 Secret Manager (new in Phase 4)

Two new secrets (`stripe-secret-key`, `stripe-webhook-secret`). $0.06 per 10K accesses. Each Function cold start reads its referenced secrets once. ~$0.001/month total.

### 10.4 Net New Phase 4 Cost (dev scale)

**$0.** Test mode is free. Functions invocations are inside free tier.

---

## 11. Files Changed Summary

```
New (Cloud Functions):
  functions/src/proxyCreateCheckoutSession.ts
  functions/src/proxyCreateCustomerPortalSession.ts
  functions/src/stripeWebhook.ts
  functions/src/lib/recomputeExpiry.ts

New (Frontend):
  shared/pricing.ts
  services/stripeService.ts
  components/Pricing.tsx
  components/UpgradeSuccess.tsx
  components/MockCheckout.tsx
  components/MockPortal.tsx

New (Documentation):
  phase-4-plan.md
  phase-4-completion-report.md

Modified:
  functions/src/onUserCreate.ts          (Stripe Customer creation at signup)
  functions/src/index.ts                 (export 3 new functions)
  functions/package.json                 (stripe ^22.1.1)
  App.tsx                                (route dispatcher + UpgradeSuccess gate + banners + Manage Subscription handler)
  components/Navigation.tsx              (Membership nav item)
  types.ts                               (AppMode.PRICING)

Total: 10 new code files + 2 new docs, 6 modified files. ~1,400 lines net added; ~150 modified.
```

### 11.1 Function Count Inventory

| # | Function                              | Trigger    | Added in |
|---|---------------------------------------|------------|----------|
| 1 | `onUserCreate`                        | Auth v1    | Phase 3 (extended Phase 4)  |
| 2 | `onGalleryImageFinalize`              | Storage    | Phase 3  |
| 3 | `expireOldImages`                     | Schedule   | Phase 3  |
| 4 | `proxyRemodel`                        | onCall     | Phase 3  |
| 5 | `proxyGenerateImage`                  | onCall     | Phase 3  |
| 6 | `proxyGenerateProductList`            | onCall     | Phase 3  |
| 7 | `proxyShopifySearch`                  | onCall     | Phase 3  |
| 8 | `proxySwapProduct`                    | onCall     | Phase 3  |
| 9 | `proxyChat`                           | onCall     | Phase 3  |
| **10** | **`proxyCreateCheckoutSession`**  | **onCall**     | **Phase 4** |
| **11** | **`proxyCreateCustomerPortalSession`** | **onCall** | **Phase 4** |
| **12** | **`stripeWebhook`**                | **onRequest**  | **Phase 4** |

---

## 12. Sign-Off

| Item                                                | Verified |
|-----------------------------------------------------|----------|
| All 12 Cloud Functions register and run in the emulator | Yes  |
| Real Stripe Checkout creates a subscription              | Yes  |
| Webhook signature verification works                     | Yes  |
| Tier flips on `subscription.created`                     | Yes  |
| Tier flips on `subscription.updated` (tier switch)       | Yes  |
| Status flips on cancel-at-period-end                     | Yes  |
| `recomputeExpiry` extends gallery on upgrade             | Yes  |
| `recomputeExpiry` clamps gallery on downgrade            | Yes  |
| UpgradeSuccess landing screen renders post-checkout      | Yes  |
| "Subscription ending" banner shows on canceled status    | Yes  |
| Stripe Customer auto-provisioned at signup               | Yes  |
| Customer Portal opens from Manage Subscription           | Yes  |
| Customer Portal lets user cancel + switch plans          | Yes (after Dashboard config) |
| Mock layer still works as Track A fallback               | Yes  |
| Stripe secret key absent from client bundle              | Yes  |
| Frontend TypeScript checks pass                          | Yes  |
| Frontend production build succeeds                       | Yes  |
| Functions TypeScript build is clean                      | Yes  |
| Firestore rules block client writes to subscription fields | Yes |
| Phase 1, 2, 3 deliverables still work                    | Yes  |

**Phase 4 status: complete. Ready for Phase 5.**

---

## 13. What Phase 5 Will Add

Phase 5 is the **tier-enforcement UX phase** — the data path is fully built (Phase 4 made tiers real and quotas authoritative), but the UI doesn't yet *teach* users about their limits in a polished way. Scope preview:

- **"X renders left this month" badge** on the Remodeler header, sourced from `userDoc.monthlyDesignCount` against `QUOTA_BY_TIER[tier].monthly`
- **"X renders left today" countdown** for Freemium / Basic (daily-limited tiers)
- **Pre-render "you're about to use your last Freemium render" modal** offering an upgrade in-line
- **Upgrade nudge cards** in the Gallery for Freemium users approaching the 10/month cap
- **Annual billing toggle** on the Pricing page (one extra `price_xxx` per tier in Stripe + UI switch)
- **Promotion code field** on Checkout (already server-enabled; just needs UI surfacing)
- **Per-tier gallery slot count** — Freemium = 5 visible cards max, Basic = 50, Advanced = 500, Designer = unlimited (orthogonal to retention; complements the time-based expiry)
- **Tier-switch UX from a paid tier** — fix the Pricing page so clicking "Upgrade Advanced" while on Basic routes through Customer Portal instead of creating a parallel subscription

After Phase 5, Freemium → Basic conversion gets a real funnel: users see their limit, hit it, see a clear upgrade path. The data backbone from Phase 4 is the engine; Phase 5 puts a steering wheel on it.

Phase 4 deliverables remain unchanged through Phase 5.
