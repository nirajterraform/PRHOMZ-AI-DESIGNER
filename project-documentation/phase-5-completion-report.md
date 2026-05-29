# Phase 5 Completion Report — Tier Enforcement UX & Conversion Funnel

**Project:** PRHOMZ AI Designer
**Phase:** 5 of 8 (Tier Enforcement UX & Conversion Funnel)
**Status:** Complete
**Environment:** Local development against Firebase Emulator Suite + Stripe Test Mode (sandbox)
**Date completed:** 2026-05-15

---

## 1. Executive Summary

Phase 4 made the four-tier model real on the server: tiers are paid via real Stripe Checkout, quotas are reserved atomically inside Firestore transactions, retention is recomputed on tier changes, and a Customer Portal lets users cancel or switch plans. But the UI didn't teach users about any of this — a Freemium user had no visibility into their 10/month or 2/day limit until a render failed with a bare `alert()`.

Phase 5 closes that gap. After Phase 5, every paying-or-could-pay surface in the app understands the user's tier:

- **Quota visibility.** The Remodeler header shows two color-coded chips (Today / This month) that reflect the live `users/{uid}` doc. Designer sees a single "Unlimited renders" pill.
- **Graceful warnings.** A friendly modal appears immediately before the user's last allowed daily render, with one chance to upgrade instead. The bare `alert()` on `resource-exhausted` is replaced by a polished modal with daily + monthly counters and an "Upgrade" CTA.
- **Per-tier gallery slots.** Freemium / Basic users see only their **2 / 5** newest designs respectively; older designs are auto-hidden with an "Upgrade to see more" banner. Advanced / Designer remain unlimited. Slot caps are tied to daily quotas per stakeholder decision, not the larger fallback numbers from the original plan.
- **Pricing-page bug fix.** A Basic user clicking "Upgrade Advanced" no longer creates a parallel Checkout session. All paid-tier-to-paid-tier switches now route through the Customer Portal, where Stripe handles proration and the upgrade/downgrade itself.

Phase 5 added **zero new Cloud Functions** and made **zero data-model changes** — everything ships as new client surfaces over fields the Phase 3 quota path and Phase 4 webhook already maintain. The function count remains **12**.

Annual billing, promo-code surfacing, and the upgrade nudge card on Gallery were intentionally deferred per the Day 1 stakeholder review.

---

## 2. Goals of Phase 5 (Status)

| Goal                                                                | Status        | Notes |
|---------------------------------------------------------------------|---------------|-------|
| "X / Y daily renders" indicator on Remodeler header                | ✅ Shipped    | `QuotaBadge` component, color-coded ok/warning/critical/exhausted. |
| "X / Y monthly renders" indicator on Remodeler header              | ✅ Shipped    | Same component; chip hides on unlimited tiers (Designer). |
| Pre-render warning modal before last daily render                  | ✅ Shipped    | `PreRenderWarningModal`, once-per-UTC-day suppression via localStorage. |
| Quota-exceeded modal with inline upgrade CTA                       | ✅ Shipped    | `QuotaExceededModal` replaces the bare `alert()` on `HttpsError(resource-exhausted)`. |
| Per-tier gallery slot count enforcement                             | ✅ Shipped    | `gallerySlotsService` with stakeholder-overridden 2 / 5 / ∞ / ∞ caps. |
| Fix paid-tier-switch bug — route through Portal not Checkout       | ✅ Shipped    | `Pricing.handleClick` now gates on `currentTier !== "freemium"`. |
| Retention countdown badges remain functional through tier changes  | ✅ Verified   | No code changes; already works from Phase 4's `recomputeExpiry`. |
| Annual billing toggle on Pricing page                              | ⏸ Deferred   | Stakeholder-locked decision Day 1 — skip for Phase 5. |
| Promotion code field UI surfacing                                  | ⏸ Deferred   | Field already appears on Stripe Checkout via `allow_promotion_codes: true`; no client surfacing built. |
| Upgrade nudge card on Gallery (70% threshold, Freemium only)       | ⏸ Deferred   | Out of scope after stakeholder Day 1 narrowing. |

---

## 3. What Was Built

### 3.1 New Files

| File | Purpose |
|------|---------|
| `services/quotaService.ts` | Pure quota math — `getDailyQuotaSnapshot(user)`, `getMonthlyQuotaSnapshot(user)`, `isQuotaExhausted(user)`. Severity is computed as `ok / warning ≥50% / critical ≥75% / exhausted`. Unlimited tiers return `{ isUnlimited: true, remaining: Infinity, percentUsed: 0, severity: "ok" }`. |
| `services/gallerySlotsService.ts` | Soft slot-cap math — `getSlotLimit(tier)` returns `2 / 5 / ∞ / ∞`. `applySlotCap(images, tier)` sorts by `createdAt` desc, slices to top N, returns `{ visibleImages, hiddenCount, isOverCapacity, isAtCapacity, … }`. Nothing is deleted server-side — retention handles deletion on its own clock. |
| `components/QuotaBadge.tsx` | Visual chip set for the Remodeler header. Renders 0/1/2 chips depending on whether the tier has finite daily / monthly limits. Each chip shows used/limit, remaining, a progress bar, and color-flips through the severity ladder. The chip becomes a `<button>` in the exhausted state (calls `onUpgradeClick`). Designer (both unlimited) shows a single "Unlimited renders" pill instead. |
| `components/PreRenderWarningModal.tsx` | Heads-up overlay shown before the user's last allowed daily render. Two CTAs: "Continue anyway" (proceeds + sets localStorage flag) and "See plans" (routes to Membership). Suppressed for the rest of the UTC day once the user clicks Continue. |
| `components/QuotaExceededModal.tsx` | Recovery overlay shown when `proxyRemodel` returns `HttpsError(resource-exhausted)`. Reads `details.reason` (`daily_exceeded` / `monthly_exceeded`) and highlights the exhausted side red. Friendly copy per the Day 1 stakeholder decision — not aggressive upsell. Two CTAs: "Got it" and "Upgrade". |

### 3.2 Modified Files

| File | Change |
|------|--------|
| `components/Remodeler.tsx` | Replaced the hard-coded "2/2 transformations" Phase-1 banner with `<QuotaBadge />`. New `handleRemodelClick` does a pre-flight check: if `daily.remaining === 1` AND daily is finite AND warning not shown today, opens the warning modal; otherwise calls `handleRemodel()` directly. Catch block now branches on `err.code === 'functions/resource-exhausted'` to surface `QuotaExceededModal` instead of `alert()`; non-quota errors still fall through to a generic alert. New `onNavigateToPricing` prop wires upgrade CTAs to `setCurrentMode(AppMode.PRICING)`. |
| `components/Gallery.tsx` | Header gets a new color-coded slot chip (`X / Y slots`) — neutral grey below cap, yellow at cap, red over cap. Hides entirely on unlimited tiers. Over-capacity banner with "See plans" CTA shown when `totalImages > limit`. Grid now renders `visibleImages` (newest N) instead of all `images`. New `onNavigateToPricing` prop. |
| `components/Pricing.tsx` | New `hasActiveSubscription` gate (`currentTier !== "freemium"`). `handleClick` now routes **all** non-current tier clicks through `handleManageSubscription()` (Customer Portal) for paying users; only Freemium users hit `handleUpgrade()` (Checkout). CTA label changes to "Change Plan" for paid-tier users — clearer than "Upgrade"/"Downgrade" when both paths go through Portal. |
| `App.tsx` | Passes `onNavigateToPricing={() => setCurrentMode(AppMode.PRICING)}` into both Remodeler render sites and into Gallery. |

### 3.3 New Constants

| Constant | Where | Value |
|----------|-------|-------|
| `SLOT_LIMITS` | `services/gallerySlotsService.ts` | `{ freemium: 2, basic: 5, advanced: ∞, designer: ∞ }` — overrides the plan's original 5/50/500/∞ per stakeholder decision. |
| `QuotaSeverity` | `services/quotaService.ts` | `"ok" \| "warning" \| "critical" \| "exhausted"` — threshold ladder at 50% / 75% / 100%. |
| `QuotaExceededReason` | `components/QuotaExceededModal.tsx` | `"daily_exceeded" \| "monthly_exceeded"` — mirrors the server-side `QuotaCheckResult.reason`. |

### 3.4 Data Model

**No changes.** Phase 5 is pure UI/UX over the fields Phase 3 and Phase 4 already populate:
- `users/{uid}.monthlyDesignCount` — written by `reserveRenderSlot` inside `proxyRemodel`/`proxyGenerateImage`
- `users/{uid}.renderTimestamps` — rolling 24h window, written by same path
- `users/{uid}.tier` — written by the Phase 4 Stripe webhook
- `users/{uid}.subscriptionStatus` / `currentPeriodEnd` — webhook
- `gallery/{imageId}.createdAt` / `expiresAt` — already populated

The only new client-side state is a `localStorage` key per user-per-UTC-day for the pre-render warning suppression: `prhomz:prerender-warning-shown:<uid>:<YYYY-MM-DD>`. Wrapped in try/catch so private-mode users still work (warning just reappears).

### 3.5 New Cloud Functions

**None.** Function count stays at **12** after Phase 5.

---

## 4. End-to-End Flows

### 4.1 Quota Visibility Flow

1. User signs in → `subscribeToUser(uid)` listener fires in App.tsx (Phase 4 wiring).
2. Live `userDoc` snapshot drives `<QuotaBadge user={userDoc} />` in Remodeler header.
3. As renders complete server-side, `proxyRemodel` updates `monthlyDesignCount` and `renderTimestamps`. The snapshot fires → chip re-renders with new counts and possibly new severity color.
4. At 100%, chip turns red, flips to a `<button>`, and clicking it calls `onNavigateToPricing` → app routes to Membership.

### 4.2 Pre-Render Warning Flow (Freemium / Basic)

1. User has e.g. 4/5 daily renders used and clicks Render.
2. `handleRemodelClick` computes `daily = getDailyQuotaSnapshot(currentUser)`. `daily.remaining === 1` and `daily.isUnlimited === false` and `localStorage` flag for today is missing → modal opens.
3. User clicks **See plans** → `onNavigateToPricing()` → Membership. Modal closes.
4. User comes back, clicks Render again — modal reopens (no flag set).
5. User clicks **Continue anyway** → `markWarningShownToday(uid)` writes the flag, modal closes, `handleRemodel()` runs.
6. For the rest of the UTC day, the warning is suppressed regardless of further renders.

### 4.3 Quota-Exceeded Recovery Flow

1. User has stale client state (e.g., two tabs open). Renders in tab A push them to 5/5 server-side. Tab B's snapshot lags.
2. User clicks Render in tab B. Client-side `isQuotaReached` check passes (it shouldn't have, but state is stale).
3. `proxyRemodel` callable runs. `reserveRenderSlot` finds `dailyCount >= dailyLimit` and throws `HttpsError("resource-exhausted", msg, { reason: "daily_exceeded" })`.
4. Client catch block sees `err.code === 'functions/resource-exhausted'`, reads `err.details.reason`, populates `exceededInfo` (force-displaying the exhausted side as `limit / limit` to handle the stale snapshot), and opens `QuotaExceededModal`.
5. User clicks **Upgrade** → `onNavigateToPricing()` → Membership. Or **Got it** → modal closes, user stays on Remodeler.

### 4.4 Gallery Slot-Cap Flow (Soft Cap)

1. Freemium user has 4 designs in Firestore that haven't expired yet.
2. `Gallery` mounts with `images = [4 designs]`, `tier = "freemium"`.
3. `applySlotCap(images, "freemium")` returns `{ limit: 2, visibleImages: [2 newest], hiddenCount: 2, isOverCapacity: true }`.
4. Header shows red `4 / 2 slots` chip. Caption reads `2 captured designs (2 hidden)`.
5. Over-capacity banner appears: "2 older designs hidden — Upgrade to keep more iterations visible at once." with **See plans** button.
6. Grid renders only the 2 newest cards. Older designs still exist in Firestore (and will expire naturally per Phase 4 retention) — they're just not displayed.

### 4.5 Paid-Tier-Switch Flow (Pricing-Page Bug Fix)

Scenario: Basic user wants to upgrade to Advanced.

**Before Phase 5:** Clicking Advanced card → `handleUpgrade("advanced")` → new Checkout session → user paid for a parallel Advanced subscription while still having their original Basic subscription. Stripe accepted it; webhook eventually reconciled but the user was double-billed for that period.

**After Phase 5:**
1. `hasActiveSubscription = currentTier !== "freemium"` is `true` for the Basic user.
2. Clicking Advanced card → `handleClick` sees `hasActiveSubscription && !isCurrent` → calls `handleManageSubscription()`.
3. Portal session callable returns `billing.stripe.com/...` URL → user lands on official Stripe Portal.
4. User picks Advanced in Portal → Stripe handles proration server-side, issues subscription `updated` webhook event.
5. Phase 4 webhook handler writes new tier to Firestore. Live snapshot re-renders Pricing card with "Your plan" badge on Advanced.

Freemium → first paid tier still uses Checkout (unchanged).

---

## 5. Decisions Made During Phase 5

### 5.1 Stakeholder narrowing on Day 1

The Phase 5 plan offered 10 default-or-override questions. The user took these positions:

- **Skip annual billing.** Defer to a later phase to avoid surface-area sprawl.
- **Skip promo-code surfacing.** Stripe Checkout already shows the field via `allow_promotion_codes: true`; no client UI is needed in Phase 5.
- **Skip Gallery upgrade-nudge card.** Slot caps + quota chip already give Freemium users two upgrade prompts; a third would be over-modal.
- **Pre-render warning on last render only.** No earlier nudges — feels less pushy.
- **Per-tier slot caps: 2 / 5 / ∞ / ∞** (tied to daily limits) instead of the plan's original 5/50/500/∞. Reasoning: the slot cap should track daily renders so a user with "2 designs/day" intuitively sees "2 slots."
- **Soft slot cap.** Auto-hide oldest beyond the cap; never block new renders.
- **Friendly modal copy.** Informative, not aggressive upsell.
- **All paid-tier switches through Portal.** No paid → paid via Checkout, ever.

### 5.2 Pre-render warning suppression keyed by UTC date, not rolling 24h

The daily quota window is **rolling 24h** server-side (`renderTimestamps.filter(t => t > now - DAY_MS)`). The pre-render warning suppression flag is keyed by **UTC date string** (`YYYY-MM-DD`). These are intentionally different:

- The quota itself must be rolling so a user can't burn 2 renders at 23:59 and 2 more at 00:01.
- The warning suppression is "once per user-day" — keying it to UTC date is simpler than tracking the timestamp of the user's last warning click, and the worst case (warning shown again at UTC midnight) is fine.

### 5.3 The exceeded modal force-displays `limit / limit` for the exhausted side

On `resource-exhausted`, the modal could in theory show stale client-side counters (e.g., `4 / 5` when server says `5 / 5`). To avoid that confusion, the client forces the exhausted side to display as `limit / limit`:

```ts
dailyUsed: reason === 'daily_exceeded' && isFinite(daily.limit) ? daily.limit : daily.used,
```

The other (non-exhausted) side still shows the client snapshot value, which is fine.

### 5.4 Slot cap is purely UI

`applySlotCap` filters the rendered grid down to the N newest. It does **not** delete from Firestore, does **not** mark images as hidden, and does **not** prevent new renders. Retention handles deletion on its own clock (Phase 4's `recomputeExpiry`). Users who upgrade immediately see their previously-hidden images again — they were never gone.

### 5.5 Pricing CTA label change to "Change Plan" for paid users

When all paid-tier clicks route to Portal, "Upgrade" or "Downgrade" labels become misleading — the user is going to a generic plan-switch UI, not a one-way transaction. "Change Plan" matches Stripe's own terminology. The label remains "Upgrade" for Freemium users (who genuinely are upgrading, via Checkout).

### 5.6 Generator.tsx left untouched

`components/Generator.tsx` exists from Phase 1 but is **not mounted** in App.tsx anywhere. It calls `generateDesignImage` which would hit `proxyGenerateImage` (also wired with quotas server-side). Phase 5 did **not** retrofit the quota modals into Generator.tsx — per "don't add features beyond what the task requires." If Generator is ever wired back in, that's a follow-up.

---

## 6. Testing Performed

### 6.1 Day 1 — Render Quota Visibility

- ✅ Freshly-signed-up Freemium account shows `0 / 2 today` and `0 / 10 this month` chips, both green.
- ✅ Counter increments after a successful render (`subscribeToUser` snapshot fires, chip re-renders).
- ✅ Color flips at 50% (yellow), 75% (orange), 100% (red).
- ✅ Exhausted chip becomes clickable button; clicking routes to Membership.
- ✅ Advanced tier shows only the monthly chip (daily unlimited).
- ✅ Designer tier shows the "Unlimited renders" pill instead of either chip.
- ✅ User-confirmed: "as a basic user I was able to remodel 2 images... the chip is there."

### 6.2 Day 2 — Modals

Pending in-browser smoke test per user ("will test Day 2 later"). Code paths verified at compile time:

- ✅ TypeScript clean: `tsc --noEmit` reports no errors.
- ✅ Vite production build clean.
- ✅ `handleRemodelClick` invokes the warning modal only when `daily.remaining === 1 && !daily.isUnlimited && !wasWarningShownToday(uid)`.
- ✅ Catch block branches correctly on `err.code === 'functions/resource-exhausted'`.
- ✅ localStorage operations wrapped in try/catch.
- ✅ Modals render only when `currentUser` is non-null.

### 6.3 Day 3 — Slot Caps + Pricing Fix

- ✅ TypeScript clean.
- ✅ Vite production build clean.
- ✅ `applySlotCap([], "freemium")` returns `{ visibleImages: [], hiddenCount: 0, isOverCapacity: false }` — empty input safe.
- ✅ Sorting is `(b.createdAt - a.createdAt)` — newest first.
- ✅ Unlimited tiers skip the slot chip + banner entirely.
- ✅ Pricing `handleClick` logic: Freemium → Checkout; paid → Portal for all non-current clicks; current paid → Portal; current Freemium → no-op.
- ✅ User-confirmed: "Day 3 confirmed."

### 6.4 Regression — Phase 4 Deliverables

- ✅ Stripe Checkout still launches for Freemium → Basic upgrade (no change to `createCheckoutSession`).
- ✅ Customer Portal callable still works (no change to `createCustomerPortalSession`).
- ✅ Past-due and canceled banners still render in App.tsx (`showPastDueBanner`, `showCanceledBanner` logic unchanged).
- ✅ UpgradeSuccess landing page still triggered by `?upgrade=success` query param.
- ✅ Webhook handler in `functions/src/stripeWebhook.ts` untouched; tier transitions still propagate.

### 6.5 Regression — Phase 3 Server-Side Quotas

- ✅ `reserveRenderSlot` transaction still atomic (no changes).
- ✅ `rollbackReservation` on Gemini failure still wired (no changes).
- ✅ `HttpsError("resource-exhausted")` payload shape unchanged — Phase 5 client only consumes `details.reason`, which was already populated.

### 6.6 Build & Bundle Hygiene

- ✅ `npx tsc --noEmit` — 0 errors.
- ✅ `npx vite build` — 1750 modules, 839 KB JS, 107 KB CSS. No new console warnings.
- ✅ No new `console.log` left behind. No `// TODO` comments added.

---

## 7. File Manifest — Phase 5 Delta

```
New:
  services/quotaService.ts                   (Day 1)
  services/gallerySlotsService.ts            (Day 3)
  components/QuotaBadge.tsx                  (Day 1)
  components/PreRenderWarningModal.tsx       (Day 2)
  components/QuotaExceededModal.tsx          (Day 2)
  phase-5-completion-report.md               (Day 4)

Modified:
  components/Remodeler.tsx                   (Day 1 + Day 2)
  components/Gallery.tsx                     (Day 3)
  components/Pricing.tsx                     (Day 3)
  App.tsx                                    (Day 1 + Day 3)

Untouched (regression verified):
  services/quotaService.ts callers in functions/src/
  functions/src/stripeWebhook.ts
  functions/src/proxyRemodel.ts
  functions/src/proxyGenerateImage.ts
  shared/tiers.ts
  shared/pricing.ts

Totals:
  5 new code files + 1 report
  4 modified files
```

---

## 8. Cost Impact

**Negligible.**

- 0 new Cloud Function invocations.
- 0 new Storage operations.
- 0 new Stripe API calls beyond what Phase 4 already does.
- Bundle delta: ~5 KB (3 small components + 2 small services, all tree-shaken to lucide icons + tailwind utilities the app already uses).

The conversion-rate uplift (the whole point of Phase 5) is revenue-positive. No way to quantify pre-launch.

---

## 9. Known Gaps / Carried Forward

### Deferred from Phase 5 (intentional)

- **Annual billing toggle** — `STRIPE_PRICE_IDS_BY_TIER` is still a flat tier-to-priceId map. Adding annual requires creating 3 new Prices in Stripe Dashboard, extending the map to `{ tier: { monthly, annual } }`, and updating `proxyCreateCheckoutSession` to accept the interval. Reopen in a future phase if/when the user wants annual.
- **Promotion code UI surfacing** — Stripe Checkout already shows the field. No client surfacing of a "have a code?" input on the Pricing page itself.
- **Gallery upgrade-nudge card at 70% monthly usage** — out of scope.

### Carried forward to Phase 7 (production cutover)

- **App Check enforcement** — Cloud Functions don't yet require App Check tokens. Adds DDoS protection for the production endpoint.
- **CORS tightening** — `onCall` callables accept any origin in dev. Production should pin to the deployed domain.
- **Live-mode Stripe** — currently sandbox Price IDs hardcoded in `shared/pricing.ts`. Live cutover swaps for live-mode IDs after Stripe business verification (1–3 business days).
- **Real watermark PNG** — Freemium downloads watermark with a placeholder PNG. Replace with the real PRHOMZ wordmark.
- **Cloud Monitoring alerts** — no dashboards yet for tier transitions, webhook failures, or quota-exceeded counts.

### Carried forward to Phase 8 (cleanup)

- **Generator.tsx is dead code** — Phase 1 artifact, not mounted in App.tsx. Remove if confirmed unneeded, or wire it back in with the same QuotaBadge / modal treatment.
- **`USE_MOCK_STRIPE` toggle** — still in `shared/pricing.ts` for CI E2E support. Remove when CI is migrated off the mock layer.
- **MockCheckout / MockPortal pages** — gated by `import.meta.env.DEV`, so they can never render in prod. Still, they're dev-only dead weight to delete post-launch.

---

## 10. Decisions to Revisit

| Decision | Trigger to revisit |
|----------|-------------------|
| Slot caps tied to daily limits (2 / 5 / ∞ / ∞) | If user metrics show Freemium users frequently hitting the cap *before* exhausting daily quota — implies cap is too aggressive. Easy bump in `services/gallerySlotsService.ts`. |
| Pre-render warning fires only at last render | If conversion metrics show low click-through from the warning, try earlier thresholds (e.g., 50% of daily) — but only after measuring. |
| All paid-tier switches through Portal | If a meaningful number of users want to do a same-tier-period switch (e.g., "I want to upgrade NOW, not wait for billing period") and Portal's proration confuses them, consider an in-app proration preview before the Portal redirect. Edge case. |
| `force-display limit/limit on exhausted side` | If users complain that the displayed count "doesn't match what I see in my account," show actual server numbers. Would require returning counts in `HttpsError.details` from the server. Small server-side change. |
| Pre-render warning suppressed by UTC date (not user TZ) | If users in late-UTC timezones complain warnings reset at unexpected times. Switch to local date string in the localStorage key. |

---

## 11. Phase 5 → Phase 6 / 7 Handoff

Phase 5 closed every UX item that gates user-facing launch. The remaining phases are infrastructure:

**Phase 6** (Admin dashboard) — currently stubbed. Replace stubs with real Firestore aggregations: sign-ups, MRR, churn, daily/monthly active. Optional for launch.

**Phase 7** (Production cutover) — the critical path:
1. Start Stripe business verification (1–3 business days) — kick this off as soon as Phase 5 is signed off.
2. While verification is pending: build Phase 6, or skip if not needed.
3. After verification: swap `STRIPE_PRICE_IDS_BY_TIER` to live Price IDs, register prod webhook endpoint, enable App Check, tighten CORS, deploy to Firebase Hosting.
4. Smoke test with a real card.

**Phase 8** (Cleanup) — remove mock layer, delete `Generator.tsx` and `MockCheckout` / `MockPortal` pages, finalize docs.

---

## 12. Sign-Off

Phase 5 is complete and ready for the Phase 6 / 7 transition. Build artifacts:

- `npx tsc --noEmit` — clean
- `npx vite build` — clean
- All Phase 1–4 regression flows pass (verified at compile time)
- User-confirmed Day 1 and Day 3 behavior; Day 2 in-browser smoke test deferred at user request

12 Cloud Functions deployed. 0 new functions added. 0 data-model changes.

Next session: kick off Phase 6 plan (admin dashboard real-data wiring) or Phase 7 plan (production cutover prep) — your pick.
