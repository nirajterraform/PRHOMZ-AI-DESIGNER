# Phase 5 Plan — Tier Enforcement UX & Conversion Funnel

**Project:** PRHOMZ AI Designer
**Phase:** 5 of 8 (Tier Enforcement UX & Conversion Funnel)
**Status:** Draft — awaiting stakeholder approval
**Environment:** Local development against Firebase Emulator Suite + Stripe Test Mode (same as Phase 4)
**Date drafted:** 2026-05-15

---

## 1. Executive Summary

Phase 4 made the four-tier model **real** on the server side — tiers are paid, quotas are enforced atomically, retention is recomputed on tier changes. But the **UI doesn't yet teach users about any of this**. A Freemium user has no idea they're approaching their 10/month or 2/day limit until the render fails with a generic error. The "Upgrade" path exists on the Pricing page but there's no in-context nudge pointing toward it.

Phase 5 is the **conversion funnel** phase. After Phase 5, a Freemium user can see at a glance how many renders they have left today and this month, gets a graceful pre-render warning before their last allowed render, and sees upgrade nudges in natural moments (when they hit a limit, when they save a render to their gallery, when they navigate to Membership). Annual billing comes in as a discount toggle on the Pricing page, and promotion codes are surfaced during Checkout.

Phase 5 also closes one **known bug** carried from Phase 4: clicking "Upgrade Advanced" on the Pricing page while already on Basic would attempt to create a parallel Checkout session, which Stripe accepts but produces a duplicate subscription. The fix is to route all paid-tier-to-paid-tier switches through the Customer Portal instead of Checkout.

Phase 5 does **not** change the data model on the server side. Everything Phase 5 needs (`monthlyDesignCount`, `dailyRenderCount`, `renderTimestamps`, `tier`) is already populated by `proxyRemodel` / `proxyGenerateImage` from Phase 3 and the webhook from Phase 4. Phase 5 is mostly client-side surfacing of those existing fields.

---

## 2. Goals of Phase 5

| Goal                                                                | Priority | Notes |
|---------------------------------------------------------------------|----------|-------|
| "X / Y daily renders" indicator on Remodeler header                | High     | Reads `renderTimestamps` filtered to last 24h. Color-coded — green > 50%, yellow 25–50%, red < 25%. |
| "X / Y monthly renders" indicator on Remodeler header              | High     | Reads `monthlyDesignCount` against `QUOTA_BY_TIER[tier].monthly`. Hides if tier has unlimited monthly (Advanced, Designer). |
| Pre-render warning modal when user is about to use their last daily render | High | Only shown for Freemium / Basic (daily-limited tiers). Single chance to cancel and upgrade instead. |
| Quota-exceeded modal with inline upgrade CTA when daily/monthly limit reached | High | Replaces the current `alert()` with the HttpsError message. Adds "Upgrade" button. |
| Upgrade nudge card on Gallery for Freemium users approaching 10/month limit | Medium | Shown when `monthlyDesignCount >= 7` (70% threshold). One per session, dismissible. |
| Annual billing toggle on Pricing page                              | Medium   | Server-side: add 3 annual `price_xxx` IDs in Stripe Dashboard. Client-side: monthly/annual toggle, ~20% discount displayed. |
| Promotion code field on Checkout Session                           | Medium   | Already server-enabled via `allow_promotion_codes: true` in Phase 4. UI just surfaces the field. |
| Per-tier gallery slot count enforcement (5/50/500/∞)               | Medium   | Different from retention. Limits **how many visible cards** a user can have at once, regardless of expiry. |
| Fix Phase 4's paid-tier-switch bug — route through Portal not Checkout | High | Single-file change in `Pricing.tsx`. |
| Retention countdown badges remain functional through tier changes  | Verify   | Should already work from Phase 4's `recomputeExpiry`. Phase 5 just verifies. |

---

## 3. Open Questions — Confirm Before Coding

Each has a recommended default. A "yes, defaults" reply unblocks Day 1.

1. **Pre-render warning threshold — at last render only, or earlier?**
   Recommended default: **at last render only** (e.g., "this is your 2/2 today — upgrade for unlimited?"). Earlier nudges feel pushy and reduce trust.

2. **Annual billing discount percentage**
   Recommended default: **20% off annual vs monthly × 12**. So Basic monthly $9.99 → annual $95.90 (effective $7.99/mo). Advanced $239.90 (effective $19.99/mo... wait, that's no discount). Let me recompute: 20% off = $9.99 × 12 × 0.8 = $95.90/year. Yes that's right.

   Common SaaS pattern. Confirms a clear value to long-term commitment without giving away too much margin.

3. **Upgrade nudge frequency on Gallery**
   Recommended default: **once per session, dismissible**. Once dismissed, no nudge until next sign-in.

4. **Pre-render warning frequency**
   Recommended default: **once per user-day**. After the user clicks "Continue anyway" once on a given day, no more warnings that day. Resets at next UTC midnight.

5. **Gallery slot caps — hard or soft?**
   Recommended default: **soft cap**. Show "5 of 5 slots used" indicator, but don't block new renders. A new render becomes the newest card; the oldest card stays visible but with an "Expired" stamp (visually muted). User can manually delete older cards to free slots.

   Hard cap (reject new renders when full) would conflict with the quota-based model — feels confusing if user has quota left but can't render.

6. **Quota-exceeded modal copy — neutral or aggressive upsell?**
   Recommended default: **friendly informative**. "You've used today's 2 renders. Try again tomorrow or upgrade for more." Two buttons: "Got it" (dismiss) and "Upgrade" (jump to Pricing). Not "YOU CAN'T DO THIS — UPGRADE NOW!!!"

7. **Promotion codes — pre-create any?**
   Recommended default: **none in Phase 5**. The infrastructure ships (codes work end-to-end if Stripe Dashboard has any). Creating actual codes is a marketing/launch task, not a code task.

8. **Per-tier gallery slot counts confirmed?**
   - Freemium: **5 visible cards** (matches the 5-fallback-inventory ergonomic)
   - Basic: **50 visible cards**
   - Advanced: **500 visible cards**
   - Designer: **unlimited**

   These are big jumps but feel intuitive. Confirm or adjust.

9. **Show "Most popular" badge on Advanced still?**
   Recommended default: **yes, unchanged from Phase 4**. Advanced is the sweet spot (unlimited daily renders, 15-day retention) and the badge increases conversion to that tier specifically.

10. **Trial period revisited?**
    Recommended default: **no, keep no-trial decision from Phase 1**. Trial periods add complexity (trial-end events, trial-to-paid funnel tracking, abuse via multiple-signup) and the existing Freemium tier already serves as a "try before you buy" path.

---

## 4. Days Breakdown

### Day 1 — Render Quota Visibility

**Goal:** Users always know how many renders they have left today and this month.

- New file `components/QuotaBadge.tsx` — single component that renders one of:
  - "2 / 2 renders today" (for Freemium / Basic with `daily` limits)
  - "100 renders this month" (the only badge for Advanced — unlimited daily)
  - Nothing (for Designer — unlimited everything)
  - Color-coded: green > 50%, yellow 25–50%, red < 25%
- Mount the badge in `components/Remodeler.tsx` header, replacing the existing inline quota strip (which currently hard-codes "2/2" — a Phase 1 artifact).
- New helper `services/quotaService.ts` — pure functions:
  - `getDailyRendersUsed(userDoc)` — counts `renderTimestamps` entries in the last 24h
  - `getMonthlyRendersUsed(userDoc)` — returns `monthlyDesignCount`
  - `getDailyLimit(tier)`, `getMonthlyLimit(tier)` — wrap `QUOTA_BY_TIER[tier]`
- Verify retention countdown badges on Gallery cards still work (no code change expected; just a visual smoke test).

### Day 2 — Pre-Render Warning + Quota-Exceeded Modal

**Goal:** Gracefully warn before the user uses their last render; gracefully recover when they hit a limit.

- New file `components/PreRenderWarningModal.tsx` — overlay shown by `Remodeler.tsx` before clicking the render button if it would be the user's last daily render. Two buttons: "Continue" (proceed with render, sets a `localStorage` flag so it doesn't show again that day) and "See plans" (route to Pricing).
- New file `components/QuotaExceededModal.tsx` — overlay shown when `proxyRemodel` throws `resource-exhausted`. Reads the error's `reason` and `monthlyUsed`/`monthlyLimit`/`dailyUsed`/`dailyLimit` from the HttpsError details. Two buttons: "Got it" (close) and "Upgrade" (route to Pricing).
- Update `Remodeler.handleRemodel` to:
  - Pre-flight check: if this would be the last daily render and warning not shown today, show `PreRenderWarningModal`
  - On `HttpsError("resource-exhausted")` response from `proxyRemodel`, show `QuotaExceededModal` instead of the current `alert()`.

### Day 3 — Annual Billing + Promotion Code UI

**Goal:** Users can see annual pricing and apply promo codes.

- **Server-side prerequisites (you do):**
  - In Stripe Dashboard, add a second recurring Price to each of the 3 Products: yearly, ~20% off effective monthly.
  - Capture the 3 new `price_xxx` IDs.
- `shared/pricing.ts` — extend `STRIPE_PRICE_IDS_BY_TIER` to a 2-axis map: `{ basic: { monthly: 'price_xxx', annual: 'price_yyy' }, ... }`. Add `ANNUAL_DISCOUNT_PERCENT` constant.
- `components/Pricing.tsx` — add a monthly/annual toggle above the cards. Cards reflect the selected interval's price (with "Save $X/year" badge on annual). Upgrade buttons pass the selected interval.
- `proxyCreateCheckoutSession.ts` — accept `interval: 'monthly' | 'annual'` input, look up the right Price ID.
- The promotion-code field already appears on Stripe Checkout pages (we enabled `allow_promotion_codes: true` in Phase 4). Just verify in testing.

### Day 4 — Per-Tier Gallery Slot Caps + Pricing-Page Bug Fix

**Goal:** Gallery shows "X of Y slots" indicator. Fix the Phase 4 paid-tier-switch issue.

- New helper `services/gallerySlotsService.ts` — `getSlotLimit(tier)` returns `5 / 50 / 500 / Infinity`.
- `components/Gallery.tsx` — add a header indicator: "5 of 5 slots used" with color-coded fill. When over capacity, show a banner suggesting upgrade or delete.
- `components/Pricing.tsx` — change the click handler so that for a user with an existing paid subscription, clicking **any** non-current tier (upgrade or downgrade) routes to the Customer Portal, NOT to Checkout. Only Freemium users hit Checkout.
- Verify: a Basic user clicking "Upgrade Advanced" should now open the Portal at `billing.stripe.com/...` where they can change plans via Stripe's official UI.

### Day 5 — Polish + Completion Report

- Smoke-test every conversion entry point: Remodeler quota chip click → Pricing. Pre-render modal "See plans" → Pricing. Quota-exceeded modal "Upgrade" → Pricing. Gallery slot-limit banner → Pricing.
- Verify mock layer still works end-to-end (CI E2E preservation).
- Verify Phase 4 deliverables still work (subscription flow, banners).
- Write `phase-5-completion-report.md`.

---

## 5. Data Model Changes

**None.** Phase 5 is pure UI/UX over the existing data:

- `userDoc.monthlyDesignCount` — already written by `reserveRenderSlot` (Phase 3)
- `userDoc.renderTimestamps` — already written, capped at 24h window
- `userDoc.tier` — already maintained by webhook (Phase 4)
- `gallery/{imageId}.expiresAt` — already recomputed on tier change (Phase 4)

The only client-side state addition is a `localStorage` flag per user-day for "pre-render warning shown today" — not persisted to Firestore.

---

## 6. New Cloud Functions

**None.** Phase 5 modifies one existing callable (`proxyCreateCheckoutSession` to accept the `interval` param for annual billing) but adds no new functions.

Function count stays at **12** after Phase 5.

---

## 7. Frontend Changes

| File                                          | Change                                                                       |
|-----------------------------------------------|------------------------------------------------------------------------------|
| `components/QuotaBadge.tsx`                   | New. Reusable quota indicator for daily / monthly.                          |
| `components/PreRenderWarningModal.tsx`        | New. Shown before last daily render.                                         |
| `components/QuotaExceededModal.tsx`           | New. Shown on HttpsError `resource-exhausted`.                              |
| `services/quotaService.ts`                    | New. Pure helpers for quota math.                                            |
| `services/gallerySlotsService.ts`             | New. Slot-cap math per tier.                                                 |
| `shared/pricing.ts`                           | Extend `STRIPE_PRICE_IDS_BY_TIER` to include `monthly` and `annual` price IDs. Add `ANNUAL_DISCOUNT_PERCENT`. |
| `components/Remodeler.tsx`                    | Replace hard-coded "2/2" with `<QuotaBadge />`. Add pre-render warning + quota-exceeded modal logic. |
| `components/Gallery.tsx`                      | Add slot-count indicator + over-capacity banner.                             |
| `components/Pricing.tsx`                      | Monthly/annual toggle. Fix paid-tier-switch to route through Portal.        |
| `functions/src/proxyCreateCheckoutSession.ts` | Accept `{ tier, interval }` input; look up `STRIPE_PRICE_IDS_BY_TIER[tier][interval]`. |

---

## 8. Testing Plan

| Test | Mechanism |
|------|-----------|
| Quota badge shows correct values for fresh Freemium user | Fresh signup → see "0/2 today, 0/10 this month" |
| Quota badge counters increment on successful render | Generate one render → "1/2 today, 1/10 this month" |
| Quota badge color flips from green to yellow to red | Generate renders until threshold; verify color |
| Pre-render warning shows before the last daily render | Generate 1/2 → click render → warning appears |
| Pre-render warning does not show twice in the same day | Continue past warning, then trigger another render → no warning |
| Quota-exceeded modal shows when user clicks render at 2/2 | Force hit the limit → modal with upgrade CTA |
| Upgrade button in modal navigates to Pricing | Click → Membership page loads |
| Annual toggle on Pricing page shows annual prices and savings badge | Toggle on/off; verify all 3 cards update |
| Annual checkout uses the annual `price_xxx` | Click Upgrade-Annual; verify Stripe Checkout shows yearly billing |
| Promotion code field appears on Stripe Checkout | Visual check on real Stripe Checkout page |
| Gallery shows "X of Y slots" indicator | Visual check on each tier |
| Gallery shows over-capacity banner when full | Generate 6+ renders on Freemium (5-slot cap) → banner shows |
| Basic user clicking "Upgrade Advanced" on Pricing routes to Portal, not Checkout | Verify URL bar goes to `billing.stripe.com/...` |
| All Phase 4 flows still work (cancel, manage, banner) | Full regression smoke |

---

## 9. Cost Impact

**Negligible.** No new Cloud Function invocations, no new Storage operations, no new Stripe API calls beyond what Phase 4 already does. The annual billing adds new `price_xxx` IDs in Stripe (free) and minimal client bundle size (~5 KB).

The only ongoing cost variable Phase 5 introduces is **higher conversion rate** (which is the whole point) — which means more subscribers, which means more Stripe transaction fees. That's revenue-positive.

---

## 10. Dependencies / Prerequisites

### Before Day 1

- All Phase 4 deliverables stable. (They are.)
- Stakeholder answers to the 10 open questions in §3.

### Before Day 3 (annual billing)

- Three new annual recurring Prices created in your Stripe Dashboard, one per Product. Capture the new `price_xxx` IDs.
- Decide on annual discount percentage (default 20%).

### Not blocking — defer to Phase 7

- Same as Phase 4: business verification, live-mode Stripe keys, production webhook endpoint.

---

## 11. Out of Scope (Intentionally Deferred)

| Item                                                | New phase | Reason for defer                                                                                              |
|-----------------------------------------------------|-----------|---------------------------------------------------------------------------------------------------------------|
| Per-seat pricing for Designer tier                  | Later     | Not in current spec; Designer is single-user.                                                                |
| Multi-currency support                              | Later     | All Prices priced in USD. International users charged in USD via Stripe's standard conversion.               |
| Coupons / promo code generation in admin            | Phase 6   | Admin dashboard will gain a "Generate promo code" tool.                                                       |
| Referral program (give X get Y)                     | Later     | Out of current scope.                                                                                         |
| Gift subscriptions                                  | Later     | Out of current scope.                                                                                         |
| Tier downgrade prevention if currentPeriodEnd is near | Later   | Edge case; let Stripe handle the timing.                                                                      |
| Email notifications on quota warnings               | Phase 7   | Requires SendGrid or Cloud Functions email integration; ties into production observability.                  |
| Renderless preview mode (visual-only mockup before render) | Later | Substantial UX work; would need its own phase.                                                            |

---

## 12. Risks

| Risk                                                                                                | Likelihood | Mitigation                                                                                                 |
|-----------------------------------------------------------------------------------------------------|------------|------------------------------------------------------------------------------------------------------------|
| Pre-render warning + quota-exceeded modal feel over-modal-heavy on small screens                    | Medium     | Use slide-in toast variant on mobile instead of full overlay. Test responsive behavior in Day 2.            |
| Localstorage flag for "warning shown today" lost on incognito / different device                    | Low        | Falls back to server-side `renderTimestamps` check at the moment of click; only the timing of the warning is affected. |
| Annual pricing math gets confusing with proration on upgrades from monthly to annual                | Low        | Stripe's default proration handles this correctly. Verify in Day 3 testing with a real switch.             |
| Per-tier slot cap conflicts with retention windows                                                   | Low        | They're orthogonal. Slot cap = how many CARDS are visible. Retention = how long each card lives. Both can hit simultaneously without conflict. |
| Phase 5's many small UI bits could collectively cause regressions                                    | Medium     | Day 5 explicit regression-smoke pass. Mock layer is preserved for CI E2E.                                  |
| User confusion: annual price shown as "$95.90" instead of "$7.99/mo"                                 | Low        | Show both — the per-month equivalent prominently, the total yearly as fine print.                          |

---

## 13. Phase 5 — File Manifest Preview

```
New:
  components/QuotaBadge.tsx
  components/PreRenderWarningModal.tsx
  components/QuotaExceededModal.tsx
  services/quotaService.ts
  services/gallerySlotsService.ts
  phase-5-completion-report.md

Modified:
  shared/pricing.ts                  (add annual price IDs)
  components/Remodeler.tsx           (QuotaBadge + modals)
  components/Gallery.tsx             (slot-count indicator)
  components/Pricing.tsx             (annual toggle + Portal routing fix)
  functions/src/proxyCreateCheckoutSession.ts  (interval input)

Total: 5 new code files + 1 new doc, 5 modified files.
```

---

## 14. Sign-Off

Before we start Day 1, please reply with:

1. **Confirm the 10 defaults in §3** (or override any of them).
2. **Confirm annual pricing math**: Basic $9.99/mo → $95.90/yr, Advanced $19.99/mo → $191.90/yr, Designer $49.99/mo → $479.90/yr (each = monthly × 12 × 0.80). Or specify a different discount.
3. **Confirm per-tier slot caps**: Freemium 5 / Basic 50 / Advanced 500 / Designer unlimited.

Once those are confirmed, Day 1 (Quota visibility) can start immediately. ~1 session.

---

## Appendix — How Phase 5 Sets Up Phase 7 (Production)

Phase 5 ships ALL features that the launch-day product needs. After Phase 5, **the only things left between you and accepting real payments are:**

1. **Phase 6** — Admin dashboard pulling from real Firestore data (so you can see actual sign-ups, MRR, churn) instead of the current stubbed data. Optional for launch — you could ship to prod without Phase 6 done and add it later.
2. **Phase 7** — Production cutover:
   - Stripe business verification (1–3 business days — start this in parallel with Phase 6!)
   - Switch to live Stripe keys + live Price IDs
   - Register prod webhook endpoint
   - App Check enforcement
   - Production domain + Firebase Hosting deploy
   - CORS tightening
   - Cloud Monitoring alerts

So **Phase 5 is the last UX-facing phase before launch**. Phase 6 and Phase 7 are mostly infrastructure and admin tooling.

If you're aiming for a specific launch date, the critical path is:

1. Finish Phase 5 (~5 days of effort)
2. Start Stripe business verification IMMEDIATELY when Phase 5 ends
3. Build Phase 6 in parallel with Stripe verification (whichever finishes first waits for the other)
4. Phase 7 cutover happens when both are ready

Phase 8 (cleanup — removing the mock checkout layer, deleting dead Phase 1 client code, finalizing docs) can happen any time after Phase 7 launch.
