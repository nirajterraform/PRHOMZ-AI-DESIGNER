# Phase 4 Plan — Stripe Subscriptions & Tier Monetization

**Project:** PRHOMZ AI Designer
**Phase:** 4 of 8 (Stripe Subscriptions & Tier Monetization)
**Status:** Draft — awaiting stakeholder approval
**Environment:** Local development against Firebase Emulator Suite + Stripe Test Mode (or mocked Stripe responses if account creation is deferred)
**Date drafted:** 2026-05-15

---

## 1. Executive Summary

Phase 4 turns the four-tier model defined in Phase 0 into a working subscription system. After Phase 4, a Freemium user can click an upgrade button, complete a Stripe Checkout flow, and immediately see their account flip to a paid tier — with quota and retention windows extending in real time. Downgrades, cancellations, and failed-payment states are all handled. The webhook is the single source of truth for `tier`, `subscriptionStatus`, `currentPeriodEnd`, and `subscriptionId` on the user doc — no other code path mutates those fields.

Phase 4 is split into two tracks to decouple from Stripe-account availability:

- **Track A (buildable without a Stripe account)** — pricing page, UI states, Cloud Function shapes, data-model fields, Firestore rule updates, and a mock-checkout simulator that fires the same Firestore writes a real webhook would. This lets us demo a fully working upgrade flow from a local environment without touching Stripe.
- **Track B (gated on a free Stripe test-mode account)** — replaces the mocked Stripe SDK calls with real ones, wires in the real Checkout/Portal URLs, and validates webhook signatures with the real secret. Track B is small (~half a day) and can be done at any point after Track A lands.

Per stakeholder spec (re-confirmed at Phase 1): **no 14-day trial** — paid tiers begin at the moment of successful Checkout. Freemium is a permanent free state.

---

## 2. Goals of Phase 4

| Goal                                                                | Track |
|---------------------------------------------------------------------|-------|
| Pricing page with Basic / Advanced / Designer cards                 | A     |
| "Manage Subscription" entry point in the user profile menu          | A     |
| Subscription state fields on `users/{uid}` (Stripe customer ID, sub ID, status, period end) | A |
| `proxyCreateCheckoutSession` callable — server creates Checkout, returns redirect URL | A (mocked) + B (real) |
| `proxyCreateCustomerPortalSession` callable — server creates Portal Session | A (mocked) + B (real) |
| `stripeWebhook` HTTP function — handles `customer.subscription.created/updated/deleted` and `invoice.payment_failed` | A (no signature check) + B (real signature) |
| `users/{uid}.tier` flips on successful checkout                     | A     |
| `users/{uid}.tier` flips back to `freemium` on cancel/end-of-period | A     |
| `users/{uid}.subscriptionStatus` reflects active / past_due / canceled / null | A |
| `recomputeExpiry(uid)` utility — extends/contracts existing gallery doc `expiresAt` on tier change | A |
| Firestore rule tightening — webhook SA is the only writer of subscription fields | A |
| "Mock checkout" page for local development demo                     | A (and remains useful for E2E in CI) |
| Stripe CLI integration for local webhook forwarding                 | B     |
| Live-mode prep checklist (business verification, bank account, etc.) | Phase 7 |

---

## 3. Open Questions — Confirm Before Coding

These need stakeholder confirmation before Day 1 starts. Each is annotated with the recommended default so a "yes, default" reply is fast.

1. **Stripe account — when will it exist?**
   Recommended default: stakeholder creates a free Stripe account whenever convenient (a 2-minute email signup). Track A proceeds in parallel and does not block on it. Track B fires off as soon as the account exists.

2. **No trial period — confirmed?**
   Recommended default: confirmed per Phase 1 spec. Paid subscriptions activate immediately on successful Checkout. No trial state.

3. **Annual pricing — in scope for Phase 4 or later?**
   Recommended default: **monthly only** for Phase 4. Annual is a single extra `price_xxx` per tier in Stripe and a UI toggle on the pricing page; we can add it in a small follow-on once the monthly flow is proven. Avoids tripling the test surface for Phase 4.

4. **Proration on upgrades — Stripe default or instant charge?**
   Recommended default: **Stripe default proration**. When a Basic user upgrades to Advanced mid-month, Stripe charges the prorated difference and the user gets Advanced immediately. This is the out-of-the-box behavior and matches user expectations.

5. **Downgrade — immediate or end-of-period?**
   Recommended default: **end-of-period downgrade**. When a Designer downgrades to Basic, they keep Designer benefits until the period ends, then drop to Basic. This is the gentler UX, matches Stripe's `cancel_at_period_end` flow, and avoids the awkward case of paying for Designer but immediately losing access to Designer-tier-only retention.

6. **Cancel — immediate or end-of-period?**
   Recommended default: **end-of-period cancel**. Same reasoning as downgrade.

7. **Failed payment grace period?**
   Recommended default: **Stripe's default 7-day retry, then auto-cancel**. We surface `subscriptionStatus: 'past_due'` in the UI with a "Payment issue — update your card" banner during the retry window.

8. **Refund policy in-app?**
   Recommended default: **out of scope for Phase 4**. Refunds happen through the Stripe Dashboard manually. If self-service refunds are desired later, that's a Phase 6+ item.

9. **Existing rendered images on downgrade — keep at old retention or recompute?**
   Recommended default: **recompute on downgrade**. When Advanced (15-day retention) drops to Basic (7-day retention), existing images get their `expiresAt` re-clamped to `min(currentExpiresAt, now + 7d)`. This avoids the loophole of stockpiling renders just before a downgrade. `recomputeExpiry(uid)` runs from inside the webhook on every tier-change event.

10. **Tax handling — Stripe Tax in scope?**
    Recommended default: **out of scope for Phase 4**. We launch with tax-inclusive pricing in test mode; Stripe Tax (or manual VAT/sales-tax handling) is a Phase 7 production-cutover concern.

---

## 4. Days Breakdown

### Day 1 (Track A) — Pricing UI + Data Model

**Goal:** A user can see the three paid tiers and click an upgrade button. The click goes nowhere yet (no Function call), but every visual state is in place.

- New file `components/Pricing.tsx` — 4-card layout (Freemium + 3 paid). Each card shows: name, price/mo, monthly + daily render limits, retention window, watermark on/off, CTA button.
- The current user's tier is highlighted as "Your Plan" on its card. CTA on the active tier becomes "Manage Subscription" instead of "Upgrade".
- Add `AppMode.PRICING` to the mode enum; add a Pricing nav item.
- Extend `UserAccount` type with `subscriptionStatus`, `currentPeriodEnd`, `stripeCustomerId`, `subscriptionId` if any are still missing. (Most were already added in Phase 1 as placeholders.)
- New helper `shared/pricing.ts` — single source of truth for `STRIPE_PRICE_IDS_BY_TIER` (filled with placeholder values during Track A, real values during Track B), plus a display-friendly `TIER_DISPLAY` constant. Built same way as `shared/tiers.ts` — copied into `functions/src/_shared/` at build time.

### Day 2 (Track A) — Cloud Function Shapes + Mock Checkout

**Goal:** Clicking an upgrade button calls a Function, which (in mock mode) redirects to a local "fake checkout" page. The fake checkout page has a Succeed / Fail toggle and triggers the same webhook handler a real Stripe event would.

- New file `functions/src/proxyCreateCheckoutSession.ts` — callable. In Track A, returns a redirect URL pointing at `/__mock-checkout?priceId=...&uid=...`. In Track B (later), this becomes `stripe.checkout.sessions.create(...)` and returns the real Checkout URL.
- New file `functions/src/proxyCreateCustomerPortalSession.ts` — same shape. In Track A, returns a redirect URL pointing at `/__mock-portal?uid=...`.
- New file `functions/src/stripeWebhook.ts` — HTTP function (not callable; receives webhook POSTs). In Track A, accepts JSON directly without signature verification (the only caller is our mock page from the same origin). In Track B, adds `stripe.webhooks.constructEvent(rawBody, signature, secret)` for verification. Handler dispatches by event type:
  - `customer.subscription.created` → set `tier`, `subscriptionStatus: 'active'`, `currentPeriodEnd`, `subscriptionId`. Call `recomputeExpiry(uid)`.
  - `customer.subscription.updated` → re-evaluate tier from price ID, update status. Call `recomputeExpiry(uid)`.
  - `customer.subscription.deleted` → drop `tier` to `freemium`, status to `null`. Call `recomputeExpiry(uid)` (which will pull retention windows in).
  - `invoice.payment_failed` → set `subscriptionStatus: 'past_due'`. No tier change yet (Stripe retries before auto-canceling).
- New file `functions/src/lib/recomputeExpiry.ts` — collection-group scan of `users/{uid}/gallery`; for each doc, recompute `expiresAt` from `createdAt` and the new tier; on downgrade, clamp to `min(existing, recomputed)` to avoid loophole; on upgrade, push out to the new window.
- New file `components/MockCheckout.tsx` — only mounted when running in emulator. Shows "You're about to subscribe to {tier} for ${price}/mo" and two buttons: "Succeed" and "Fail". Succeed posts the equivalent of `customer.subscription.created` to the local `stripeWebhook` URL; Fail does nothing and goes back. Used in CI for E2E tests without Stripe.

### Day 3 (Track A) — Webhook Integration + Firestore Rules

**Goal:** When the mock-checkout "Succeed" fires, the user's tier flips, the UI re-renders, gallery doc retention windows update. All within ~1 second.

- Wire `proxyCreateCheckoutSession` into the Pricing page upgrade buttons.
- Wire `proxyCreateCustomerPortalSession` into the "Manage Subscription" CTA and the user profile menu.
- New screen `components/UpgradeSuccess.tsx` — shown after the Checkout redirect with the user's new tier, prorated charge (if applicable), and a button to start their first paid render.
- Tighten `firestore.rules` — extend the existing user-doc `hasAny([...])` block to explicitly include the new server-only fields. (`stripeCustomerId`, `subscriptionId`, `subscriptionStatus`, `currentPeriodEnd` were in the Phase 3 list already; verify they're still there post-merge.)
- Test all the flows end to end via the mock checkout.

### Day 4 (Track B) — Real Stripe Wiring (gated on account)

**Goal:** Replace the mock layer with real Stripe SDK calls. The mock layer stays in the codebase as a dev-only fallback.

- Add `stripe` package to `functions/package.json`. Install with `npm --prefix functions install stripe`.
- In `proxyCreateCheckoutSession.ts`: read the real `STRIPE_SECRET_KEY` secret; call `stripe.checkout.sessions.create({ mode: 'subscription', line_items: [...], customer: stripeCustomerId, success_url, cancel_url, allow_promotion_codes: true })`; return the session URL.
- In `proxyCreateCustomerPortalSession.ts`: call `stripe.billingPortal.sessions.create({ customer })`; return the portal URL.
- In `stripeWebhook.ts`: add `stripe.webhooks.constructEvent(rawBody, signature, secret)` at the entry point; reject with 401 on invalid signature. The dispatch logic underneath is unchanged from Track A.
- In `onUserCreate.ts` (Phase 3): extend to call `stripe.customers.create({ email, metadata: { firebaseUid } })` and store the resulting `cus_xxx` on the new user doc. New users get a Stripe Customer at signup — even Freemium ones — so upgrade flow is one less round trip.
- Replace placeholder values in `shared/pricing.ts` with the real `price_xxx` IDs from your Stripe Dashboard.
- Add `stripe-secret-key` and `stripe-webhook-secret` to GCP Secret Manager via Terraform (add to `infra/secrets.tf`); populate locally in `functions/.secret.local`.
- Install Stripe CLI locally; document `stripe listen --forward-to localhost:5001/.../stripeWebhook` for the dev workflow.
- Switch a `USE_MOCK_STRIPE` flag (env var or build-time constant) to `false`; the mock layer becomes dead code in prod paths but stays around for tests.

### Day 5 (both tracks) — Polish & Validation

**Goal:** All UX states feel finished. Edge cases tested.

- Banner on every page when `subscriptionStatus === 'past_due'` — orange, "Update payment method", links to the Customer Portal.
- Banner when `subscriptionStatus === 'canceled'` and `currentPeriodEnd > now` — gray, "Subscription ending DD MMM YYYY. Renew?".
- Banner when `subscriptionStatus === 'canceled'` and `currentPeriodEnd <= now` — none (user is back on Freemium and pricing page is the natural CTA).
- Quota chip on Remodeler reflects new limits live (no refresh needed) — already works via the user subscription, just verify.
- Retention chip on Gallery cards updates live after a tier change — `recomputeExpiry` rewrites `expiresAt` so the existing live re-render hits.
- Phase 4 completion report.

---

## 5. Data Model Changes

### 5.1 `users/{uid}` — extensions

| Field                  | Type          | Notes                                                  |
|------------------------|---------------|--------------------------------------------------------|
| `stripeCustomerId`     | string \| null | Filled either by `onUserCreate` (Track B) or by the first webhook event for the user (Track A) |
| `subscriptionId`       | string \| null | Stripe sub ID                                          |
| `subscriptionStatus`   | enum \| null  | `'active' \| 'past_due' \| 'canceled' \| null`         |
| `currentPeriodEnd`     | number \| null | UNIX ms; drives the "Subscription ending DD MMM" banner |

All four fields are **server-only** in `firestore.rules` (already added in Phase 3's tightening, but explicitly re-verified in Phase 4 Day 3).

### 5.2 No new collections

Stripe state is owned entirely by Stripe. We don't mirror invoices or charges in Firestore — the Customer Portal handles invoice download. If we ever need invoice history in-app, that's a separate read-only callable that hits Stripe directly.

---

## 6. New Cloud Functions

| Function                              | Trigger     | Track | Purpose                                                                  |
|---------------------------------------|-------------|-------|--------------------------------------------------------------------------|
| `proxyCreateCheckoutSession`          | onCall      | A + B | Returns the Stripe Checkout (or mock checkout) URL                       |
| `proxyCreateCustomerPortalSession`    | onCall      | A + B | Returns the Stripe Customer Portal (or mock portal) URL                  |
| `stripeWebhook`                       | onRequest   | A + B | Receives subscription events; updates user doc; calls `recomputeExpiry`  |

Plus one helper, not a Function:

| Helper                                | Module                     | Purpose                                                                  |
|---------------------------------------|----------------------------|--------------------------------------------------------------------------|
| `recomputeExpiry(uid, newTier)`       | `functions/src/lib/recomputeExpiry.ts` | Iterates gallery docs and rewrites `expiresAt` against the new tier  |

This brings the total Function count to **12** (9 from Phase 3 + 3 new). Memory and timeout settings stay modest — none of the new Functions touch Gemini or large images. `proxyCreate*` are 256 MiB / 30 s. `stripeWebhook` is 512 MiB / 60 s to handle worst-case `recomputeExpiry` over a large gallery.

---

## 7. Frontend Changes

| File                          | Change                                                                        |
|-------------------------------|-------------------------------------------------------------------------------|
| `components/Pricing.tsx`      | New. 4-card pricing page.                                                     |
| `components/UpgradeSuccess.tsx` | New. Confirmation screen post-checkout redirect.                            |
| `components/MockCheckout.tsx` | New, emulator-only. Local fake checkout for Track A.                          |
| `components/Navigation.tsx`   | Add Pricing nav item.                                                         |
| `App.tsx`                     | Add `AppMode.PRICING` case in the renderer. Profile dropdown gets a "Manage Subscription" item that calls `proxyCreateCustomerPortalSession`. |
| `App.tsx` (banners)           | Conditional banner row above the main content for `past_due` / `canceled` states. |
| `types.ts`                    | Confirm `SubscriptionStatus` type covers all webhook states; add `currentPeriodEnd` if missing. |
| `shared/pricing.ts`           | New. Tier → Stripe Price ID mapping + display constants.                      |
| `services/stripeService.ts`   | New. Thin httpsCallable wrappers for the two callable Functions.              |

---

## 8. Mock vs Real Stripe — Implementation Detail

The two-track split is implemented with a single switch:

```
shared/pricing.ts:
  export const STRIPE_PRICE_IDS_BY_TIER = {
    basic:    'mock_basic'    // Track A: placeholder; Track B: real price_xxx
    advanced: 'mock_advanced'
    designer: 'mock_designer'
  };
  export const USE_MOCK_STRIPE = !process.env.STRIPE_SECRET_KEY;
```

The Functions branch on `USE_MOCK_STRIPE`:

- Mock mode: `proxyCreateCheckoutSession` returns `https://app/__mock-checkout?priceId=...`. The MockCheckout page POSTs to `/stripeWebhook` directly on the user's button click. No Stripe SDK is required at runtime; `stripe` package is still installed but unused.
- Real mode: same callables call into the real Stripe SDK; `stripeWebhook` enforces signatures.

The mock page is **emulator-only** — guarded by `import.meta.env.DEV` so it can't be reached in production builds. This is also our path forward for CI E2E tests in Phase 7 — we don't want CI tests to depend on Stripe-API availability, so they exercise the mock layer.

---

## 9. Alternative Payment Gateways — Considered & Rejected

For the record:

| Gateway     | Verdict                                                                        |
|-------------|--------------------------------------------------------------------------------|
| Stripe      | Picked. Industry standard for SaaS subscriptions, best DX, free test mode, well-supported on Firebase. |
| PayPal Sandbox | Free test mode, but no Checkout-equivalent, different webhook patterns, no Customer Portal. Building against PayPal then switching to Stripe later doubles the work. |
| Square Sandbox | Free test mode, but oriented at point-of-sale and one-time charges; subscription support is comparatively thin. |
| LemonSqueezy | Free test mode, Merchant-of-Record (handles tax). API is Stripe-like. Possible alternative if MoR is the explicit goal — but locks us into LemonSqueezy's fee structure (5% + $0.50 vs Stripe's 2.9% + $0.30) and revenue is captured by them, not us. |
| Paddle      | Free sandbox, Merchant-of-Record. Same MoR pros/cons as LemonSqueezy. |

**Decision:** Stripe, with the two-track build approach. Stripe test mode is itself free, so there's nothing to "save" by going elsewhere — and the spec calls for Stripe in production anyway.

---

## 10. Testing Plan

### Track A tests (no Stripe account needed)

| Test                                                              | Mechanism                                              |
|-------------------------------------------------------------------|--------------------------------------------------------|
| Pricing page renders with current tier highlighted                | Manual                                                 |
| Click upgrade → mock checkout page opens                          | Manual                                                 |
| Mock checkout "Succeed" → tier flips in Firestore within ~1s      | Watch Firestore emulator UI                            |
| Mock checkout "Succeed" → all gallery docs' `expiresAt` extend     | Inspect doc fields before/after                        |
| Mock checkout "Fail" → no Firestore changes                        | Confirm doc unchanged                                  |
| Quota banner on Remodeler updates without page refresh             | Generate a render after upgrade; observe daily counter |
| Downgrade via mock portal → `expiresAt` re-clamps on existing docs | Inspect doc fields; verify min() applied               |
| Cancel via mock portal → `tier` stays until `currentPeriodEnd`, then flips on next webhook | Set period end in mock; trigger update event |
| `invoice.payment_failed` mock event → `past_due` banner appears    | Click a "simulate payment fail" button in MockPortal   |
| Firestore rules: client cannot directly set `tier` or `subscriptionStatus` | Try from a Firestore emulator client session |
| Pricing page displays correct copy for the No-Trial spec           | Visual review                                          |

### Track B tests (Stripe test mode account required)

| Test                                                              | Mechanism                                              |
|-------------------------------------------------------------------|--------------------------------------------------------|
| Real Checkout with `4242 4242 4242 4242` → returns to UpgradeSuccess with tier flipped | E2E in browser |
| Real Checkout with `4000 0000 0000 0002` (decline) → returns to pricing page, no tier change | E2E |
| Stripe CLI forwarding fires webhook on local; signature verified  | `stripe listen --forward-to ...`                       |
| Bad signature on webhook → 401 returned, no Firestore writes      | `curl` with a fake signature                           |
| Upgrade in Customer Portal → updated event fires, tier promotes   | Use portal UI; observe Firestore                       |
| Cancel in Customer Portal → `cancel_at_period_end` set; tier stays; on period end, deleted event fires | Use portal UI; advance Stripe test clock |
| Real refund issued in Stripe Dashboard → no impact on tier (refunds don't auto-cancel) | Manual via dashboard |

---

## 11. Cost Impact

### 11.1 Stripe Fees

Stripe charges **2.9% + $0.30** per successful card transaction (US standard rate; international cards are slightly more). On our three tiers:

| Tier | Price/mo | Stripe Fee | Net to PRHOMZ |
|------|----------|-----------|--------------|
| Basic | $9.99    | $0.59      | $9.40        |
| Advanced | $19.99 | $0.88      | $19.11       |
| Designer | $49.99 | $1.75      | $48.24       |

At 100 Basic + 50 Advanced + 20 Designer subscribers: gross $2,498/mo, fees ~$130/mo, net ~$2,368/mo.

### 11.2 Cloud Functions

`stripeWebhook` invocation per event is well within free tier. `proxyCreate*` are called once per upgrade click — even at 1,000 upgrades/month, free tier covers it.

### 11.3 Secret Manager

Two new secrets (`stripe-secret-key`, `stripe-webhook-secret`). Same negligible read cost as the Gemini + Shopify secrets — under $0.01/month.

### 11.4 Net New Phase 4 Cost (dev scale)

**Effectively $0.** Stripe test mode charges nothing; the Functions are within free tier.

---

## 12. Dependencies / Prerequisites

### Before Day 1 of Track A:

- All Phase 3 deliverables stable (they are — see [phase-3-completion-report.md](phase-3-completion-report.md)).
- Stakeholder answers to the 10 open questions in §3.

### Before Day 4 of Track B:

- A Stripe account (free, ~2 minutes to create at https://dashboard.stripe.com/register).
- Test-mode secret key + publishable key (auto-generated on account creation).
- Three Products + Prices created in the test-mode Dashboard:
  - "Basic" — $9.99/mo recurring
  - "Advanced" — $19.99/mo recurring
  - "Designer" — $49.99/mo recurring
- A test-mode webhook endpoint registered, listening to `customer.subscription.*` and `invoice.payment_failed`. Webhook signing secret captured.
- Stripe CLI installed locally (`brew install stripe/stripe-cli/stripe`).

### Not blocking — defer to Phase 7 (live launch):

- Business verification with Stripe (legal name, address, SSN/EIN, bank account for payouts).
- Switching the Stripe account from Test to Live mode.
- Updating to live-mode price IDs and webhook secret.

---

## 13. Out of Scope (Intentionally Deferred)

| Item                                            | New phase | Reason for defer                                                                                                  |
|-------------------------------------------------|-----------|-------------------------------------------------------------------------------------------------------------------|
| Annual billing                                  | Phase 5   | Single Stripe Price addition + UI toggle; doesn't change the architecture.                                        |
| Promotion codes / coupons                       | Phase 5   | `allow_promotion_codes: true` is already in our Checkout config; the work is creating the codes in Stripe Dashboard. |
| Per-seat pricing for Designer tier              | Phase 5+  | Not in current spec; Designer is single-user.                                                                     |
| In-app refund requests                          | Later     | Refunds go through the Stripe Dashboard manually until volume justifies self-service.                             |
| Stripe Tax integration                          | Phase 7   | Production-launch concern; we launch with tax-inclusive pricing in test mode.                                     |
| Invoice/receipt history viewer in-app           | Later     | Customer Portal already shows this.                                                                               |
| ACH / bank-debit support                        | Later     | Card-only at launch.                                                                                              |
| Trial period                                    | Out       | Confirmed not in product spec.                                                                                    |
| Per-tier gallery slot count enforcement (5/50/500/∞) | Phase 5 | Will use the now-real `tier` field once it flows through reliably.                                                |
| Live-mode cutover                               | Phase 7   | Requires Stripe business verification.                                                                            |

---

## 14. Risks

| Risk                                                                                                | Likelihood | Mitigation                                                                                                 |
|-----------------------------------------------------------------------------------------------------|------------|------------------------------------------------------------------------------------------------------------|
| Webhook handler races with the Checkout success redirect — user sees old tier briefly               | Medium     | UpgradeSuccess page subscribes to the user doc and waits for the tier update before showing the "Start" button; it's a ~500 ms wait at most. |
| `recomputeExpiry` on a Designer with 500+ gallery docs hits the Function timeout                    | Low        | Batch in chunks of 100 with `Promise.all`; 512 MiB / 60 s is plenty for the typical user. Edge cases will be exercised on a synthetic large gallery in testing. |
| Stripe signing-secret rotation breaks the webhook                                                   | Low        | Document the rotation process in §8 of the Phase 4 completion report. Stripe lets you have two active secrets during rotation. |
| Mock checkout accidentally gets enabled in production                                               | Low        | Guarded by `import.meta.env.DEV` AND a server-side `USE_MOCK_STRIPE` check that requires `STRIPE_SECRET_KEY` to be unset. Both must agree for mock to engage. |
| Downgrade clamps `expiresAt` and surprises a user                                                   | Medium     | UpgradeSuccess (or DowngradeConfirmation) explains the retention change up front. The Customer Portal also surfaces this. |
| Test cards in `4242…` family that pass Checkout but fail at the subscription-renewal step (Stripe's `4000 0000 0000 0341`) — webhook delivery for `invoice.payment_failed` may be delayed | Low | We test specifically for the `payment_failed` event in Track B testing. |

---

## 15. Phase 4 — File Manifest Preview

This is a forward-looking estimate of files that will land. Pin this list and we use it as the basis for the Phase 4 completion report's §3.1.

```
New:
  components/Pricing.tsx
  components/UpgradeSuccess.tsx
  components/MockCheckout.tsx
  services/stripeService.ts
  shared/pricing.ts

  functions/src/proxyCreateCheckoutSession.ts
  functions/src/proxyCreateCustomerPortalSession.ts
  functions/src/stripeWebhook.ts
  functions/src/lib/recomputeExpiry.ts

  infra/secrets.tf                  (extend with stripe-* secrets)
  phase-4-completion-report.md

Modified:
  components/Navigation.tsx
  App.tsx
  types.ts                          (re-confirm subscription field coverage)
  firestore.rules                   (re-confirm server-only fields list)
  functions/src/index.ts            (export 3 new functions)
  functions/src/onUserCreate.ts     (Track B — Stripe customer create)
  functions/package.json            (Track B — stripe dep)
  functions/.secret.local           (Track B — stripe-secret-key, stripe-webhook-secret)

Total: 10 new + 8 modified files.
```

---

## 16. Sign-Off

Before we start Day 1, please reply with:

1. **Confirm the 10 defaults in §3** (or override any of them).
2. **Confirm the two-track approach** — yes to building Track A now without a Stripe account, picking up Track B whenever the account exists.
3. **Confirm Stripe stays the chosen gateway** (not switching to PayPal / LemonSqueezy / Paddle).
4. **Indicate timing on Track B** — best-effort estimate of when the Stripe account will exist, even rough ("this week", "next month") helps planning.

Once those are confirmed, Day 1 (Pricing page + data model extensions) can start immediately and lands in roughly a session.

---

## Appendix A — How a Real Stripe Checkout Flow Works End to End

For reference, since this is the first integration with a real third-party billing system.

1. User clicks Upgrade on the Pricing page.
2. Client calls `proxyCreateCheckoutSession({ tier: 'basic' })`.
3. Server: looks up the user's `stripeCustomerId` (creates one if missing). Looks up the price ID for the tier. Calls `stripe.checkout.sessions.create(...)`. Returns the Checkout URL.
4. Client redirects to the Checkout URL — `https://checkout.stripe.com/c/pay/cs_test_...`.
5. User enters card details on Stripe-hosted page. Card is validated; payment method is attached; subscription is created.
6. Stripe redirects the browser to our `success_url` (set to `/upgrade-success?session_id={CHECKOUT_SESSION_ID}`).
7. **Independently**, Stripe POSTs `customer.subscription.created` to our `stripeWebhook` endpoint within ~1–5 seconds.
8. Our webhook handler verifies the signature, updates the user doc, calls `recomputeExpiry`.
9. The UpgradeSuccess page (which is subscribed to the user doc) sees the tier change and renders the success state.

The 6→8 race is what the UpgradeSuccess subscription handles — the page does *not* infer success from the redirect; it waits for the Firestore update that proves the webhook fired.

---

## Appendix B — Stripe Account Creation Walkthrough (for when you're ready)

1. Visit https://dashboard.stripe.com/register
2. Email + password. No business documents required.
3. You'll land in the Dashboard. Note the toggle in the top-right between **Test mode** (default) and **Live mode**. Stay in Test mode for all of Phase 4.
4. Sidebar → Developers → API keys. Copy the test-mode "Secret key" (`sk_test_...`). This goes in `functions/.secret.local` as `stripe-secret-key=sk_test_...`.
5. Sidebar → Products → + Add product. Create three:
   - Name "Basic", recurring monthly, $9.99 — captures a `price_xxx` ID.
   - Same for Advanced ($19.99) and Designer ($49.99).
   - Save those three `price_xxx` IDs into `shared/pricing.ts`.
6. Sidebar → Developers → Webhooks → + Add endpoint. URL is the deployed function URL (we'll generate it with `firebase deploy --only functions:stripeWebhook` first). Select events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. The page shows a "Signing secret" — copy it into `functions/.secret.local` as `stripe-webhook-secret=whsec_...`.
7. For local development: `brew install stripe/stripe-cli/stripe`, then `stripe login`, then `stripe listen --forward-to http://localhost:5001/prhomz-dev-code-test/us-central1/stripeWebhook`. The CLI prints its own local-only webhook secret, which you use during emulator dev.

That's everything Track B needs. Whole flow takes 10–15 minutes once you have the time.
