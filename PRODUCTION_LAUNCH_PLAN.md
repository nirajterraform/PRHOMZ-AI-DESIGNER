# Production Launch Plan — Blue Brand Designer + Landing Updates

**Goal:** promote the approved **blue-brand designer app** to production (`designer.prhomzai.com`) and ship **two landing-page changes** to `prhomzai.com`. Both live in GCP project `prhomzmvp-nonprod`.

> Rule: nothing deploys until this plan is approved. Every gcloud/firebase command is preceded by `unset GOOGLE_IMPERSONATE_SERVICE_ACCOUNT`.

---

## Two independent deployments
| # | What | Target | Domain | Deploy mechanism |
|---|------|--------|--------|------------------|
| A | Designer app (blue brand) | Firebase Hosting `app` (site `prhomzmvp-nonprod`) | designer.prhomzai.com | `vite build` + `firebase deploy --only hosting:app` |
| B | Landing page (2 changes) | Cloud Run service `landing` (us-central1) | prhomzai.com | `gcloud builds submit` + `gcloud run deploy landing` |

---

## Landing change 1 — "How it works" boxes → open the designer (APPROVED approach)
Section `#process` in `PRHOMZ-AI-LANDING/src/App.tsx` (~lines 526–850): three step cards, currently static demos that users mistake for the real app.

- **Wrap each box in a real anchor** — reuse the existing CTA pattern/URL exactly:
  `<a href="https://designer.prhomzai.com/" target="_blank" rel="noopener noreferrer" className="block h-full"> …card… </a>`
  (mobile-reliable real link; same URL as nav "GET STARTED" / hero "START DESIGN" / pricing "TRY FREE").
- **Preserve the fake animations:** on the inner demo buttons (Take Picture / Upload / Generate) add `onClick={(e) => { e.stopPropagation(); …existing… }}` so they keep animating and do NOT navigate.
- **Result:** clicking anywhere on a box opens the designer in a new tab; the demo buttons still play their animation; auto-play animations untouched.

## Landing change 2 — sync "PRHOMZ AI MEMBERSHIP" to the designer
Source of truth = designer `shared/pricing.ts` (`TIER_DISPLAY`). Landing file: `PRHOMZ-AI-LANDING/src/components/PricingSubscription.tsx` (`planTiers`, lines 20–94).

| Tier | Price | Landing now | Designer (correct) | Action |
|---|---|---|---|---|
| Freemium | $0 ✅ | **10** renders/mo | **30** renders/mo | **Fix 10 → 30** |
| Basic | $9.99 ✅ | 100/mo, 7-day, no WM | 100/mo, **unlimited daily**, 7-day, no WM | Add "Unlimited daily" bullet |
| Advanced | $19.99 ✅ | 300/mo, unlimited daily, 15-day | same ✅ | none |
| Designer | $49.99 ✅ | unlimited mo+daily, 30-day | same ✅ | none |

Prices, retention (24h/7/15/30), watermark flags already match. **Approach (D2): sync the facts (Freemium 10→30, add Basic "Unlimited daily") and keep the landing's marketing wording.**

---

## The runbook

### Phase 0 — Pre-flight & backups (no deploy)
1. `unset GOOGLE_IMPERSONATE_SERVICE_ACCOUNT`; confirm `gcloud config get-value account` = niraj.sriwastava@gmail.com.
2. **Designer rollback point:** brand work committed to git (Phase 2.1); Firebase Hosting keeps the current release for one-click console rollback.
3. **Landing rollback point:** capture the serving revision —
   `gcloud run services describe landing --region us-central1 --project prhomzmvp-nonprod --format="value(status.latestReadyRevisionName)"`
4. Confirm the landing Cloud Run service (name `landing`, region `us-central1`) exists and is serving prhomzai.com.

### Phase 1 — Implement landing changes (local, review before prod)
1. In `PRHOMZ-AI-LANDING`: apply Change 1 (anchor-wrap + `stopPropagation`) and Change 2 (Freemium 30 + Basic daily).
2. `npm run build` (tsc/lint clean); run locally and screenshot-verify: boxes open the designer, demos still animate, membership shows Freemium 30.
3. Commit to the landing repo (its own git: `origin` = nirajterraform/PRHOMZ-AI-LANDING).

### Phase 2 — Deploy DESIGNER app (first)
1. Commit the brand work (designer repo) and merge `feature/top-nav-condensed-layout` → `main` (promote step).
2. `npx tsc --noEmit` then `VITE_THEME=brand npm run build`.
3. `npx firebase-tools deploy --only hosting:app --project prhomzmvp-nonprod`  ← only live-touching designer command; `:app` only (does not touch landing hosting).
4. **Verify** `https://designer.prhomzai.com/`: blue brand theme, wordmark, Renders pill, quota-reached upgrade card, Shop-the-Look mobile (new tab), and the stale daily-quota gate now cleared.

### Phase 3 — Deploy LANDING (tagged preview → traffic)
1. `gcloud builds submit --config cloudbuild.yaml --substitutions=_IMAGE_TAG=vN --project=prhomzmvp-nonprod .` (bump `vN`; do NOT reuse v1).
2. Deploy with NO traffic for a prod-preview:
   `gcloud run deploy landing --image us-central1-docker.pkg.dev/prhomzmvp-nonprod/api/landing:vN --region us-central1 --project prhomzmvp-nonprod --no-traffic --tag next`  → preview URL `next---landing-…`.
3. **Verify** the preview URL (boxes → designer, demos animate, Freemium 30). prhomzai.com still untouched.
4. Go live: `gcloud run services update-traffic landing --to-latest --region us-central1 --project prhomzmvp-nonprod`.
5. **Verify** `https://prhomzai.com/`.

### Phase 4 — Post-launch
1. Full E2E: designer sign-up/login/generate/shop; landing CTAs + "How it works" boxes → designer; membership parity across both sites.
2. **KEEP the preview channels** (do NOT delete now). Extend the `brand-design` channel expiry so it survives the PWA phase (redeploy with `--expires 30d`, or bump as needed). `green-design` is retired (blue won) — optional to delete now or keep until final cleanup.
3. Update `RUNBOOK.md` (designer release + landing `vN`); tag releases in both repos.

### Phase 5 — PWA / mobility (later, after go-live)
1. Build PWA/mobility on the **brand channel** first ([[project_mobility_plan]]: manifest + 512/192 icons + service worker). Preview channels are HTTPS, so PWA install + service workers work there.
2. Verify on the brand channel; iterate.
3. If successful → **second production round** (same designer deploy flow: build + `firebase deploy --only hosting:app`).
4. **Only after** the PWA production round is verified → delete preview channels: `firebase hosting:channel:delete green-design` + `firebase hosting:channel:delete brand-design`.

---

## Rollback (fast)
- **Designer:** Firebase Console → Hosting → Rollback to previous release (instant); or rebuild pre-merge `main` and redeploy.
- **Landing:** `gcloud run services update-traffic landing --to-revisions=<PREV_REVISION>=100 --region us-central1 --project prhomzmvp-nonprod` (instant revert to the Phase-0 revision).

## Decisions (current)
- **D1 How-it-works:** APPROVED — box = link, demo buttons `stopPropagation` (animations preserved).
- **D2 Membership sync:** facts-only (Freemium 10→30, Basic +daily), keep landing wording. *(confirm)*
- **D3 PWA/mobility:** APPROVED — done AFTER this go-live, on the brand channel, then a 2nd production round (Phase 5).
- **D4 Deploy order:** designer first, then landing. *(confirm)*
- **D5 Delete preview channels:** UPDATED — **keep** channels through the PWA phase; delete only after the PWA production round is verified.

## Out of scope / untouched
- Staging environment build (paused at 84/87) — unrelated to this go-live.
- Backend `api` / `stripe-webhook` Cloud Run services — no changes.
- No live secrets, no Stripe/live-key changes.
