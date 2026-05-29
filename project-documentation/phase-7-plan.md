# Phase 7 Plan — Production Cutover & Demo Deploy

**Project:** PRHOMZ AI Designer
**Phase:** 7 of 8 (Production Cutover)
**Status:** Draft — awaiting stakeholder approval
**Environment:** Local emulator (current) → GCP project (deployed)
**Date drafted:** 2026-05-15

---

## 1. Executive Summary

Through Phase 5 the entire stack works flawlessly against the **Firebase Emulator Suite** plus **Stripe Test Mode**. Phase 7 moves the same code from emulators to **your GCP project** and from Stripe Test Mode to **Stripe Live Mode**. No new features ship in Phase 7; this is a configuration, infrastructure, and hardening phase.

Phase 7 is intentionally structured so that **Day 1 is a standalone "demo on GCP" path**. After Day 1 you have a publicly reachable URL that demos every flow built in Phases 1–5, using the same Stripe sandbox keys and the same Gemini API key you've been using locally. No real money moves, no production accounts created.

Days 2–5 are the additional work that makes the demo URL into a real production launch:

- **Day 2** — switch from Stripe sandbox to live mode (gated by Stripe business verification, 1–3 business days)
- **Day 3** — security hardening (App Check enforcement, CORS tightening, real watermark PNG)
- **Day 4** — observability (Cloud Monitoring, alerting, log dashboards)
- **Day 5** — custom domain (optional) + Phase 7 completion report

You can stop after Day 1 if "demo only" is the goal. You can stop after Day 2 if "live launch but no custom domain or monitoring" is acceptable. Each day is shippable on its own.

---

## 2. Goals of Phase 7

| Goal                                                              | Priority | Notes |
|-------------------------------------------------------------------|----------|-------|
| Working demo URL on GCP using sandbox Stripe + existing Gemini key | High     | Day 1 — the answer to "what do I need to demo on GCP?" |
| Live Stripe Mode (real card payments)                              | High     | Day 2; gated by Stripe business verification |
| App Check enforcement on all Cloud Functions                       | High     | Day 3; prevents abuse of public callable endpoints |
| CORS allowlist tightened to production origin only                 | High     | Day 3; closes the "any origin" hole left by emulator dev |
| Real watermark PNG replacing the placeholder                       | Medium   | Day 3; Freemium downloads currently watermark with a stub |
| Cloud Monitoring dashboards + alert policies                       | High     | Day 4; surface webhook failures, quota spikes, function errors |
| Error Reporting wired with notification channel                    | High     | Day 4; oncall awareness when something breaks |
| Firestore PITR + scheduled exports                                 | Medium   | Day 4; backup story for the user/gallery collections |
| Custom domain on Firebase Hosting                                  | Optional | Day 5; skip if `firebaseapp.com` subdomain is fine for v1 |
| Phase 7 completion report                                          | Required | Day 5; audit trail of cutover decisions |
| ToS + Privacy Policy pages                                         | Required | Day 5 (or earlier); legal pre-launch checklist |

---

## 3. Demo / Sandbox Deploy Path — Day 1 in Detail

This is what you do **right now** to put the existing code on your GCP project for a demo, using sandbox Stripe and your existing Gemini key.

### 3.1 Prerequisites (already in place if you've been running emulators)

- A GCP project. From earlier work this is `prhomz-dev-code-test`. Confirm with `gcloud config get-value project`.
- Firebase CLI installed and authenticated: `firebase login`.
- Terraform stack applied: `cd infra && terraform apply` — produces the Firebase web config, Firestore database, Storage bucket, Secret Manager secrets, service accounts.
- Stripe sandbox account with the three Price IDs already created (basic / advanced / designer).
- Gemini API key.
- Shopify Storefront token.

### 3.2 Step-by-step

**Step 1 — Verify Secret Manager has every secret in your GCP project (not just `.secret.local`).**

```bash
gcloud secrets list --project=prhomz-dev-code-test
```

You need versions populated for: `gemini-api-key`, `shopify-token`, `stripe-secret-key`, `stripe-webhook-secret`. Use the `printf '%s' "value" | gcloud secrets versions add ... --data-file=-` pattern (no trailing newline). The `stripe-webhook-secret` will be re-populated in Step 7 once you register the deployed webhook URL — for now put the sandbox CLI signing secret as a placeholder.

**Step 2 — Add a Firebase Hosting block to [firebase.json](firebase.json).**

The current config has `firestore` / `storage` / `functions` / `emulators` but no `hosting`. Add:

```json
"hosting": {
  "public": "dist",
  "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
  "rewrites": [{ "source": "**", "destination": "/index.html" }]
}
```

**Step 3 — Create `.env.production`.**

The build needs to know it's targeting deployed Firebase, not the emulator. Copy `.env.local` and set:

```
VITE_USE_FIREBASE_EMULATOR=false
VITE_FIREBASE_API_KEY=<from terraform output firebase_web_config>
VITE_FIREBASE_AUTH_DOMAIN=prhomz-dev-code-test.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=prhomz-dev-code-test
VITE_FIREBASE_STORAGE_BUCKET=prhomz-dev-code-test.firebasestorage.app
VITE_FIREBASE_APP_ID=<from terraform output>
```

`firebase_web_config` is a Terraform output — get it with `cd infra && terraform output -json firebase_web_config`.

**Step 4 — Build the frontend against the production env.**

```bash
npx vite build --mode production
```

This produces `dist/` with the deployed Firebase config baked in. Verify with `grep -c "localhost" dist/assets/*.js` — expect **0**.

**Step 5 — Build and deploy Cloud Functions.**

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions --project prhomz-dev-code-test
```

First deploy takes ~5 minutes. You'll see 12 functions provisioned: 3 triggers (`onUserCreate`, `onGalleryImageFinalize`, `expireOldImages`), 6 Gemini/Shopify proxies, 2 Stripe callables, 1 Stripe HTTP webhook.

**Step 6 — Deploy Firestore + Storage rules and indexes.**

```bash
firebase deploy --only firestore,storage --project prhomz-dev-code-test
```

This pushes [firestore.rules](firestore.rules), [storage.rules](storage.rules), and [firestore.indexes.json](firestore.indexes.json). Required so the deployed Functions can actually read/write what they expect, and clients are gated correctly.

**Step 7 — Register the deployed webhook URL in Stripe Dashboard (Test Mode).**

In Stripe Dashboard → Developers → Webhooks (make sure you're in **Test Mode**), add an endpoint:

```
https://us-central1-prhomz-dev-code-test.cloudfunctions.net/stripeWebhook
```

Subscribe to: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.

Stripe gives you a new webhook signing secret (`whsec_…`). Put that in Secret Manager:

```bash
printf '%s' "whsec_REPLACE_ME" | gcloud secrets versions add stripe-webhook-secret \
  --data-file=- --project=prhomz-dev-code-test
```

Redeploy the webhook function so it picks up the new secret version:

```bash
firebase deploy --only functions:stripeWebhook --project prhomz-dev-code-test
```

**Step 8 — Deploy Hosting.**

```bash
firebase deploy --only hosting --project prhomz-dev-code-test
```

You get a URL like `https://prhomz-dev-code-test.web.app`. That's the demo URL.

**Step 9 — Smoke-test the demo URL.**

- Sign up with a fresh email; verify email arrives; click verification link.
- Sign in; land on Remodeler with `0 / 2 today` chip.
- Upload an image; render once; verify image appears in Gallery; verify chip is now `1 / 2 today`.
- Click Membership; click Upgrade Basic → Stripe Checkout opens; pay with test card `4242 4242 4242 4242`; redirected back with `?upgrade=success`; banner shows Basic.
- Open Stripe Dashboard webhook page → verify the most recent event shows `200 OK`. If it shows `400` your webhook secret is wrong; redo Step 7.

If all 5 work, the demo is live.

### 3.3 What you do NOT need for Day 1 demo

- Stripe business verification (sandbox doesn't need it).
- Rotating the Gemini key (the one in Secret Manager is fine for the demo; rotate before live launch).
- App Check (your demo URL is public but obscure; no abuse vector).
- CORS tightening (Firebase callables accept your hosting origin by default).
- A custom domain (`*.web.app` is fine).
- Cloud Monitoring (you'll watch the demo manually).
- Real watermark PNG (the placeholder watermark still demonstrates the watermark feature).

### 3.4 Demo rollback

If the demo breaks, two options:

- **Roll back Hosting:** `firebase hosting:clone <source-site>:live <target-site>:live` to a previous release.
- **Roll back Functions:** redeploy from an earlier git tag: `git checkout <tag> -- functions/ && cd functions && npm run build && firebase deploy --only functions`.

Hosting and Functions are versioned independently — you can pin one without disturbing the other.

---

## 4. Open Questions — Confirm Before Day 2

Each has a recommended default. A "yes, defaults" reply unblocks Day 2.

1. **Domain strategy.**
   - Default: ship Phase 7 on `prhomz-dev-code-test.web.app` (Firebase subdomain). Custom domain as Day 5.
   - Override: provide a custom domain now (will add ~24h for DNS + SSL provisioning).

2. **App Check provider.**
   - Default: reCAPTCHA Enterprise v3 (site-key based, free quota covers a launch). Set up in Firebase console.
   - Override: AppCheck Debug provider for staging, swap to reCAPTCHA in prod.

3. **Cloud Monitoring alert channels.**
   - Default: **email only** for v1 — send to one human email. Add Slack/PagerDuty later if oncall rotation exists.
   - Override: specify Slack webhook or PagerDuty service key.

4. **Logs retention.**
   - Default: **30 days** (Cloud Logging free tier default). Adequate for debugging recent issues.
   - Override: extend to 90d or 365d (~$0.50/GB/month).

5. **Backup strategy.**
   - Default: **Firestore PITR** (Point-in-Time Recovery, 7-day window) + **daily scheduled export** to a backup GCS bucket. Restores cover up to 7d of mistakes.
   - Override: skip PITR (lower cost), keep only daily exports.

6. **Watermark PNG.**
   - Default: I produce a simple "PRHOMZ" wordmark PNG (white text, transparent, semi-translucent) and check it in. You can replace later.
   - Override: you provide the asset.

7. **Email notifications (SendGrid / similar).**
   - Default: **defer to a later phase.** Auto-emails (welcome, payment-failed, etc.) are nice-to-have, not launch-blocking.
   - Override: include in Phase 7 (adds ~1 day).

8. **Annual billing.**
   - Default: confirmed deferred (per Phase 5 stakeholder decision). Not in Phase 7.
   - Override: re-include now that we're going live.

9. **ToS / Privacy Policy.**
   - Default: I draft template versions and you fill in business-specific details (company name, jurisdiction, support email). Hosted as `/terms` and `/privacy` static pages.
   - Override: you provide finalized text, or skip until later (legal risk — not recommended).

10. **Cutover strategy.**
    - Default: **switch test → live in place** on the same GCP project. Risk: a misconfigured live key briefly affects all users.
    - Override: clone to a second GCP project (`prhomz-prod`) and switch DNS over — zero-downtime, but ~half a day of duplicate setup. Recommended for actual launch.

---

## 5. Days Breakdown

### Day 1 — GCP Demo Deploy

**Goal:** Existing code runs on GCP at a public URL, sandbox Stripe, existing Gemini key. Already detailed in §3.

**Acceptance:** Five smoke-test scenarios in §3.2 Step 9 all pass.

### Day 2 — Live Stripe Cutover

**Goal:** Real payments. Same code; different Stripe keys; different Price IDs.

**Prerequisites:** Stripe business verification approved (start the form on Day 1 — takes 1–3 business days).

**Tasks:**
- In Stripe Dashboard (Live Mode), create the 3 recurring Products + Prices (mirror sandbox).
- Capture the live `price_…` IDs.
- Decide ID strategy. Two options:
  - **(a) Environment-based:** read `STRIPE_PRICE_IDS_BY_TIER` from env vars baked into the Vite build. `.env.production` carries live IDs; `.env.development` carries sandbox. Cleanest.
  - **(b) Hardcoded swap:** replace sandbox IDs in `shared/pricing.ts` with live IDs in a single commit. Simpler, more dangerous (no rollback button).
  - Recommended: **(a)**.
- Update Secret Manager secrets to live versions:
  - `stripe-secret-key` → `sk_live_…`
  - `stripe-webhook-secret` → live webhook signing secret (from a NEW webhook endpoint you register in Live Mode pointing at the same `stripeWebhook` URL).
- Redeploy `proxyCreateCheckoutSession`, `proxyCreateCustomerPortalSession`, `stripeWebhook` so they pick up the new secret versions.
- End-to-end test with a real card. Charge yourself $9.99 for Basic, verify webhook fires, verify Firestore reflects Basic, then immediately refund and cancel in the Stripe Dashboard.

**Acceptance:** A real card produces a real charge, refunds work, and your account returns to Freemium.

### Day 3 — Security Hardening

**Goal:** Close the public attack surfaces.

**Tasks:**
- **App Check.** Enable reCAPTCHA Enterprise in GCP. Get site key. Add `initializeAppCheck` to `services/firebaseClient.ts`. In Firebase Console, enable App Check enforcement for Cloud Functions. Verify a request without an App Check token is rejected.
- **CORS.** Add `cors: ["https://prhomz-dev-code-test.web.app"]` to every `onCall` in `functions/src/` (and to the future custom domain). For `stripeWebhook` (HTTP function), restrict to Stripe's IP allowlist via `request.ip` check — Stripe publishes their webhook source ranges.
- **Real watermark PNG.** Replace [functions/src/lib/watermark.ts](functions/src/lib/watermark.ts)'s placeholder with the actual PRHOMZ wordmark. Re-test that Freemium downloads carry the visible watermark.
- **Firestore rules audit.** One more careful read-through of [firestore.rules](firestore.rules) — specifically the server-only-write block for tier / quota fields. Confirm every field that should be server-only is in the deny list.
- **Storage rules audit.** Similar pass on [storage.rules](storage.rules).

**Acceptance:** A curl request to any callable without an App Check header returns 401. The watermark on a Freemium download is visible and on-brand. Rules audit signed off.

### Day 4 — Observability

**Goal:** When something breaks in prod, you know within minutes, not days.

**Tasks:**
- **Cloud Monitoring dashboards.** One dashboard with: function invocation count, function error rate, function p95 latency, webhook 4xx/5xx rates, Firestore read/write QPS, Storage egress.
- **Alert policies** (notification → email channel from §4.3):
  - Webhook returns 4xx or 5xx for > 1% over a 5-minute window.
  - Any function error rate > 5% over a 5-minute window.
  - Function p95 latency > 10 s over a 5-minute window.
  - Firestore daily quota approaching limit.
  - Daily render count drops to zero (canary).
- **Error Reporting.** Enabled by default for Cloud Functions; just verify it shows up in the GCP console and route alerts to the same email channel.
- **Cloud Logging dashboards.** A saved query for webhook failures, a query for `resource-exhausted` HttpsError throws, a query for Stripe signature verification failures.
- **Firestore PITR.** Enable in Firebase Console → Firestore → Backups.
- **Scheduled exports.** A Cloud Scheduler job firing daily that runs `gcloud firestore export gs://prhomz-backup-bucket/firestore-$(date +%Y-%m-%d)`.

**Acceptance:** Deliberately trigger a webhook signature failure (send a curl with a bad signature) and watch an alert email arrive within 10 minutes.

### Day 5 — Domain + ToS + Cutover Report

**Goal:** Launch-ready URL with legal pages.

**Tasks (if custom domain):**
- Add the domain in Firebase Console → Hosting → Add custom domain.
- Update DNS records (TXT for verification, A/AAAA for the apex, CNAME for www).
- Wait for SSL cert provisioning (auto, ~1h after DNS propagation).
- Update `.env.production` `VITE_FIREBASE_AUTH_DOMAIN` (only if using auth redirects). Update CORS allowlists from Day 3 to include the new domain.

**Tasks (always):**
- **Static `/terms` and `/privacy` pages.** Either two routes in the React app or two static HTML files at `dist/terms.html` + `dist/privacy.html`. Linked from the Auth screen footer and the profile dropdown.
- **Final end-to-end smoke test** on the production URL with a real card.
- **Phase 7 completion report** in the style of the prior reports.

**Acceptance:** Production URL serves the app over HTTPS with a custom (or `*.web.app`) domain, ToS + Privacy reachable, smoke test passes.

---

## 6. Data Model Changes

**None.** Phase 7 is configuration + infrastructure only. No new Firestore fields, no new collections.

---

## 7. New Cloud Functions

**One.** A small `httpHealth` function that returns `200 OK` with a JSON body containing build SHA, deployed version, and current timestamp. Used by Cloud Monitoring uptime checks. Roughly 30 lines.

Function count after Phase 7: **13**.

Everything else in Phase 7 is configuration changes (App Check enforcement flags, CORS arrays, secret versions) on existing functions.

---

## 8. Frontend Changes

| File                                    | Change                                                                                       |
|-----------------------------------------|----------------------------------------------------------------------------------------------|
| `firebase.json`                         | Add `hosting` block.                                                                         |
| `.env.production`                       | New file (gitignored). Carries deployed Firebase config.                                     |
| `services/firebaseClient.ts`            | Add `initializeAppCheck` initialization (Day 3).                                             |
| `shared/pricing.ts` (or `.env`)         | Either add env-based price-ID lookup OR replace sandbox IDs with live IDs (Day 2).          |
| `components/Auth.tsx`                   | Add footer links to `/terms` and `/privacy` (Day 5).                                         |
| `App.tsx` (route handling)              | Add routes for `/terms` and `/privacy` (Day 5).                                              |
| `public/terms.html` and `public/privacy.html` | New static pages with finalized legal text (Day 5).                                    |

---

## 9. Testing Plan

| Test                                                                  | Day    | Mechanism |
|-----------------------------------------------------------------------|--------|-----------|
| Demo URL loads; Auth screen renders                                   | Day 1  | Browser  |
| Signup + email verification end-to-end                                | Day 1  | Browser  |
| Freemium render path on deployed Functions                            | Day 1  | Browser  |
| Stripe sandbox checkout from deployed URL                             | Day 1  | Browser  |
| Webhook fires on `checkout.session.completed`, Firestore reflects tier | Day 1  | Stripe Dashboard + Firebase Console |
| Real card charge → Basic tier                                          | Day 2  | Browser + real card |
| Real card refund → tier rolls back                                     | Day 2  | Stripe Dashboard |
| Callable without App Check token → 401                                 | Day 3  | curl |
| Callable from non-allowlisted origin → CORS error                      | Day 3  | curl with bad Origin header |
| Freemium download carries real watermark PNG                           | Day 3  | Visual |
| Alert email arrives within 10 min of triggered webhook failure         | Day 4  | curl with bad sig + watch inbox |
| Firestore PITR restore-to-timestamp works                              | Day 4  | gcloud firestore restore |
| Scheduled daily export lands in backup bucket                          | Day 4  | gcloud storage ls |
| Custom domain serves the app over HTTPS                                | Day 5  | Browser |
| `/terms` and `/privacy` reachable from Auth screen and profile         | Day 5  | Browser |
| All Phase 5 flows regression-pass on prod URL                          | Day 5  | Browser |

---

## 10. Cost Impact

| Component | Expected monthly cost at low-traffic launch |
|-----------|---------------------------------------------|
| Cloud Functions invocations | $0–5 (free tier covers ~2M invocations/month) |
| Firestore reads/writes | $0–10 (free tier covers 50k reads/20k writes per day) |
| Cloud Storage | $0–5 (depends on image volume; ~$0.02/GB-month) |
| Firebase Hosting | $0 (free tier 10 GB egress/month) |
| Cloud Monitoring + Logging | $0–3 (free tier covers most launch traffic) |
| Secret Manager | <$1 |
| Cloud Scheduler (daily export) | <$0.10 |
| reCAPTCHA Enterprise | $0 (free up to 10k assessments/month) |
| Stripe transaction fees | 2.9% + $0.30 per transaction (revenue-positive) |
| Firestore daily exports → Storage | <$1 |
| **Total non-Stripe** | **~$5–25/month at launch** |

The Stripe fees scale with revenue, so they're revenue-positive by definition.

Pre-launch (during Phase 7 work), the only cost is the daily Firestore exports kicking in — under $0.10/day until you have meaningful data.

---

## 11. Dependencies / Prerequisites

### Before Day 1 (demo)

- ✅ Terraform stack applied (`infra/`).
- ✅ Firebase CLI authenticated.
- ✅ Secret Manager secrets populated (Gemini, Shopify, Stripe sandbox keys, stripe-webhook-secret placeholder).
- ✅ Stripe sandbox Products + Prices created (basic / advanced / designer).
- A working `gcloud` install and the correct project set.

### Before Day 2 (live cutover)

- Stripe business verification approved (1–3 business days — start on Day 1).
- Decision on env-based vs hardcoded price IDs (§4.10).
- A real test card belonging to you for the post-cutover smoke test.

### Before Day 3 (security)

- reCAPTCHA Enterprise site key (create in GCP Console).
- Real watermark PNG asset (or accept the default I'll generate).
- Stripe's published webhook IP ranges (their docs).

### Before Day 4 (observability)

- An email address to receive alerts (per §4.3).

### Before Day 5 (domain)

- A registered domain (only if custom-domain path).
- Access to the domain's DNS records.
- Finalized ToS + Privacy text (template I'll draft is filled in with business specifics).

---

## 12. Out of Scope (Intentionally Deferred)

| Item | New phase | Why deferred |
|------|-----------|--------------|
| Annual billing | Future | Stakeholder-deferred from Phase 5. Add when annual revenue motion is needed. |
| Multi-region deployment | Future | Single-region (us-central1) is fine for v1. |
| Multi-currency support | Future | USD-only at launch. |
| Email notifications (welcome, payment failed, etc.) | Phase 7 or future | Default deferred per §4.7. |
| Admin dashboard | Phase 6 | Optional for launch; can ship to prod without it. |
| SSO providers (Google / Apple) | Future | Email/password is sufficient for v1. |
| Mobile native apps | Far future | Out of current product scope. |
| Promotional code admin panel | Future | Stripe Dashboard handles code creation manually. |
| Trial periods | Stakeholder-rejected | Confirmed no-trial in Phase 1; no plans to revisit. |

---

## 13. Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Stripe business verification rejected or delayed > 3 days | Medium | Submit immediately on Day 1 so the wait runs in parallel with Days 1, 3, 4. Verification typically asks for tax ID, business address, and a bank account — have these ready. |
| Live Stripe webhook secret mismatch causes silent payment failures | Medium | Day 2 acceptance test catches this: real card test → verify webhook 200 in Stripe Dashboard. |
| App Check enforcement breaks legitimate clients | Low | Stage roll-out: enable in "audit mode" first (logs violations without rejecting), check logs for false positives, then flip to enforcement. |
| CORS allowlist misconfigured locks out legitimate origin | Low | Include both `prhomz-dev-code-test.web.app` and the custom domain (if used) in the allowlist. Add the dev URL `http://localhost:5050` for emulator development. |
| Firestore PITR doesn't include a critical mistake (e.g., > 7d old) | Low | Daily scheduled exports cover the gap. PITR + exports = belt and suspenders. |
| Custom-domain SSL cert provisioning takes longer than 1h | Low | Firebase auto-provisions Let's Encrypt; 99% of cases complete in 15 min, edge cases up to 24h. Don't tie launch date tightly to this. |
| `.env.production` accidentally committed (leaks Firebase config) | Low | Firebase web config is **public by design** (it's in your bundle anyway). Not actually a security issue. The secrets that matter (Gemini key, Stripe secret) live only in Secret Manager. |
| One of the existing Cloud Functions fails to deploy first time (cold deploy) | Low | Each function deploys independently. Retry on the specific function: `firebase deploy --only functions:<name>`. |
| Demo URL is publicly indexable; someone burns through your Gemini quota | Low | Day 3 App Check closes this. For Day 1 demo, this is acceptable — share the URL only with people you trust, watch Gemini usage in GCP console. |

---

## 14. File Manifest Preview

```
New:
  firebase.json                         (Day 1, add hosting block)
  .env.production                       (Day 1, gitignored)
  functions/src/httpHealth.ts           (Day 4)
  public/terms.html                     (Day 5)
  public/privacy.html                   (Day 5)
  phase-7-completion-report.md          (Day 5)

Modified:
  services/firebaseClient.ts            (Day 3, add App Check init)
  shared/pricing.ts OR .env.production  (Day 2, live Stripe IDs via env)
  components/Auth.tsx                   (Day 5, footer links to /terms /privacy)
  App.tsx                               (Day 5, /terms /privacy routes)
  functions/src/proxyRemodel.ts         (Day 3, add cors option)
  functions/src/proxyGenerateImage.ts   (Day 3, add cors option)
  functions/src/proxyChat.ts            (Day 3, add cors option)
  functions/src/proxyGenerateProductList.ts  (Day 3, add cors option)
  functions/src/proxyShopifySearch.ts   (Day 3, add cors option)
  functions/src/proxySwapProduct.ts     (Day 3, add cors option)
  functions/src/proxyCreateCheckoutSession.ts  (Day 3, add cors option)
  functions/src/proxyCreateCustomerPortalSession.ts  (Day 3, add cors option)
  functions/src/stripeWebhook.ts        (Day 3, Stripe IP allowlist)
  functions/src/lib/watermark.ts        (Day 3, real PNG asset)
  functions/src/index.ts                (Day 4, export httpHealth)

Untouched:
  All Phase 1–5 client code (Pricing, Remodeler, Gallery, QuotaBadge, modals, services/*)
  Firestore + Storage rules (already production-ready)

Totals:
  6 new files (1 new function, 2 legal pages, 1 hosting config, 1 env file, 1 report)
  14 modified files (mostly cors/option flag additions on existing functions)
```

---

## 15. Sign-Off

Before starting Day 1 (demo deploy), please reply with:

1. **GCP project ID** to deploy to (confirm `prhomz-dev-code-test` or specify another).
2. **Are you OK with the Gemini API key in Secret Manager** being used for the demo as-is? (Reminder: it was exposed in chat — rotate before live launch in Day 2, but sandbox demo on the same dev project is fine.)
3. **Confirm sandbox Stripe Price IDs** are correct: basic `price_1TXKZtQvWrs0iL1QklCqzrEh`, advanced `price_1TXKanQvWrs0iL1QCRgdf30v`, designer `price_1TXKbgQvWrs0iL1QAprPVviL`.

Once those are confirmed, **Day 1 starts immediately**. Day 1 is roughly half a session of execution, end-to-end. After Day 1 you have a demo URL.

Days 2–5 each unblock the next, but you can pause after any of them.

---

## Appendix A — Why Phase 7 Is Configuration, Not Code

Almost every Phase 7 change is a **flag flip**, a **secret rotation**, or a **rule tightening** — not new logic. The code already does the right thing under the assumption that:

- Secrets exist in Secret Manager (they do).
- Stripe keys point to the right environment (sandbox today, live in Day 2).
- App Check tokens are validated if present (they are; we just need to enforce required-mode).
- CORS allows the requesting origin (configurable per-function).
- The watermark library uses whatever PNG is bundled (swap the file, no code changes).

The largest code-level change in Phase 7 is the `httpHealth` function for uptime checks — about 30 lines.

This is why Phase 7 maps cleanly to "deploy and harden," not "build more features."

---

## Appendix B — Demo / Sandbox vs Production — Side-by-Side

| Concern                  | Demo (Day 1)                          | Production (after Day 2+)                       |
|--------------------------|---------------------------------------|-------------------------------------------------|
| Stripe mode              | Test (sandbox)                        | Live                                            |
| Stripe Price IDs         | Sandbox IDs in `shared/pricing.ts`    | Live IDs via `.env.production`                  |
| Stripe webhook URL       | Test mode endpoint pointing at deployed function | Live mode endpoint, same URL                |
| Stripe webhook secret    | Test signing secret                   | Live signing secret                             |
| Gemini API key           | Existing dev key                      | Same or rotated dev key                         |
| App Check                | Off                                   | Enforced                                        |
| CORS                     | Open (any origin)                     | Allowlist (prod domain only)                    |
| Watermark PNG            | Placeholder stub                      | Real PRHOMZ wordmark                            |
| Cloud Monitoring         | Off                                   | Dashboards + alerts wired                       |
| Firestore PITR + exports | Off                                   | Enabled                                         |
| Domain                   | `*.web.app`                           | Custom domain (optional)                        |
| ToS / Privacy            | Not present                           | Linked from Auth + profile                      |
| Real money               | Never (test mode only)                | Yes                                             |

Day 1 gets you the left column. Days 2–5 progressively migrate to the right column.
