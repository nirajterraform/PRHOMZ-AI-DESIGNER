# Full-Stack Staging (Non-Prod) Environment — Build Plan

**Goal:** stand up a second, fully-isolated environment (`prhomzmvp-staging`) that clones the
current live stack, so frequent/risky changes (backend, quota, Stripe, Firestore rules, data
model) can be proven **before** they touch the live project. Live (`prhomzmvp-nonprod`, which
despite its name is production today) is **not touched** during this build.

> Terminology in this doc: **LIVE** = the current `prhomzmvp-nonprod` project serving
> designer.prhomzai.com. **STAGING** = the new `prhomzmvp-staging` project we're building.

---

## 0. Key decisions to confirm before we start

| # | Decision | Recommendation | Why it matters |
|---|----------|----------------|----------------|
| D1 | **Region** | `us-central1` (same as live) | Firestore region is **permanent** once created. Must match live to keep behaviour identical. |
| D2 | **Stripe** | Use **test mode** of a Stripe account (test keys + test price IDs) | Never touch real money in staging. Needs new test price IDs (§Stripe prereqs). |
| D3 | **Domain** | Start on the free `*.web.app` + `*.run.app` URLs; add `staging.designer.prhomzai.com` later only if you want a pretty URL | Custom domain adds DNS + cert steps; not required for a functional staging env. |
| D4 | **Landing site** | **Skip** for staging (it's an external Cloud Run service, not in this repo) | The designer app is what changes frequently; landing is stable. Can add later. |
| D5 | **Firestore data** | Start **empty** (fresh) | Staging should not carry real user PII. Create test accounts as needed. |
| D6 | **GA4 / Sentry** | **Disable** in staging (strip GA4 tag, leave `VITE_SENTRY_DSN` empty) | Keeps test traffic out of production analytics/error dashboards. |
| D7 | **SendGrid sender** | Reuse `noreply@prhomzai.com` **or** a `staging@` subuser | Auth/verification emails need a working sender; simplest is to reuse the verified domain. |

---

## 1. Prerequisites — what YOU need to do (by vendor)

These are the human/console/billing steps I can't do for you. Once these are ready, the build
is mostly automated on my side.

### GCP
1. **Create the project** `prhomzmvp-staging` (or a name you prefer) under the same org/billing.
   - *You do this* (or grant me `resourcemanager.projectCreator` on the org/folder and I script it).
2. **Link billing** — attach billing account `017C0F-1D7641-1EFA90` (same as live) to the new project.
3. **Confirm your identity has `Owner`** (or Editor + Project IAM Admin + Service Usage Admin) on
   the new project so Terraform can enable APIs and create resources.
4. Confirm the `unset GOOGLE_IMPERSONATE_SERVICE_ACCOUNT` shell caveat still applies (it does) — I'll
   handle it in every gcloud/terraform command.

### Stripe
5. **Stripe test mode** — no new account needed; every Stripe account has a built-in **Test mode**.
   In the Stripe Dashboard (Test mode toggle ON):
   - Grab the **test** `Secret key` (`sk_test_…`) → for the `stripe-secret-key` secret.
   - Create **3 test Products/Prices** mirroring live (Basic / Advanced / Designer) → note the
     3 `price_test_…` IDs. (I'll put them in `shared/pricing.ts` for the staging build.)
   - We'll create the **test webhook endpoint** *after* the staging `stripe-webhook` URL exists,
     then you copy its signing secret (`whsec_…`) → `stripe-webhook-secret`.

### SendGrid
6. Decide D7. If reusing `noreply@prhomzai.com`: just provide a **SendGrid API key** with Mail Send
   scope (can be the same key or a new restricted one) → `sendgrid-api-key` secret. Domain is already
   authenticated, so nothing else to do.

### Google AI / Vertex
7. **Gemini API key** for the staging project (a separate key keeps quota/billing isolated) →
   `gemini-api-key` secret. (If you plan to move to Vertex AI later per the prod-migration note,
   staging is a good place to trial it — but for a like-for-like clone, a Gemini key matches live.)

### MaxMind
8. **MaxMind license key** (for the GeoLite2 geofence DB baked at build time) → `maxmind-license-key`
   secret. Can reuse the existing key.

### Shopify
9. `shopify-access-token` — per memory, the app no longer uses a real Shopify token (Shop-the-Look
   just links to prhomz.com). We can populate a **dummy/placeholder** value to satisfy the secret
   binding. Confirm that's fine.

### GA4 / Sentry
10. Nothing needed if we follow D6 (disable both in staging).

### Domain (only if D3 = custom domain)
11. Ability to add a DNS record for `staging.designer.prhomzai.com` (GoDaddy delegate access you
    already have). We do this at the end.

**Minimum to start Phase 1:** items 1–4 (GCP project + billing + owner). The Stripe/SendGrid/
Gemini/MaxMind secrets are needed by Phase 3, so you can gather them in parallel.

---

## 2. Build plan — what I do (phased, each phase reviewable)

### Phase 1 — Terraform scaffold + project bootstrap  *(no live impact)*
- Create `infra/envs/staging/` by cloning `infra/envs/nonprod/`:
  - `terraform.tfvars` → `project_id = "prhomzmvp-staging"`, same `region`, `billing_account_id`,
    `alert_emails` (or a staging-only list).
  - `backend.tf` → new state bucket `prhomzmvp-staging-tfstate`, prefix `envs/staging`.
- Create the GCS state bucket, `terraform init`, `terraform plan` → **you review the plan**, then
  `terraform apply`. This provisions: 25 APIs, runtime SA + IAM, 6 (empty) Secret Manager secrets,
  the 2 Cloud Run services (bootstrap placeholder image), Firebase project + web app, Identity
  Platform email/password auth, Firestore `(default)` + PITR + daily backups, `${project}-gallery`
  bucket, Artifact Registry `api` repo, 2 Scheduler jobs, the Eventarc gallery trigger, and
  monitoring/alerts/uptime/dashboards.

### Phase 2 — Populate the 6 secrets  *(you provide values; I add versions)*
- `gcloud secrets versions add` for: `gemini-api-key`, `shopify-access-token` (dummy ok),
  `stripe-secret-key` (**test**), `stripe-webhook-secret` (added in Phase 5), `sendgrid-api-key`,
  `maxmind-license-key`. Values pasted via a local file, **never in chat**.

### Phase 3 — Build & deploy the backend  *(staging Artifact Registry)*
- Point `api/cloudbuild.yaml` `_IMAGE_BASE` + `availableSecrets` at the staging project (staging-only
  edit; I'll keep it parameterized so it doesn't clobber live's config).
- `gcloud builds submit --config api/cloudbuild.yaml` → pushes `…/prhomzmvp-staging/api/api:v1`.
- `gcloud run deploy api` and `stripe-webhook` with the staging image → real staging service URLs
  (new `*.run.app` hash).

### Phase 4 — Frontend build & deploy  *(staging Firebase Hosting)*
- Create `.env.local.staging` from `terraform output firebase_web_config` + the new API/webhook URLs;
  `VITE_SENTRY_DSN` empty; strip the GA4 tag from the staging build.
- Set staging Stripe **test** price IDs in `shared/pricing.ts` for the staging build.
- `.firebaserc` / `firebase.json` staging hosting site + storage bucket.
- `vite build` → `firebase-tools deploy --only hosting` **to the staging project** (this is a real
  deploy, but to the staging project only — live is a different project entirely, untouched).

### Phase 5 — Auth, webhook, domain wiring
- Add staging domains to **Firebase Auth authorized domains** (console — manual, not in TF).
- Create the Stripe **test webhook** → staging `stripe-webhook` URL; copy `whsec_…` into the
  `stripe-webhook-secret` secret; redeploy `stripe-webhook`.
- (Optional D3) Map `staging.designer.prhomzai.com` on Firebase Hosting + DNS + cert.

### Phase 6 — Smoke test
- Run `SMOKE_TEST.md` against staging: sign-up → email verify → login → generate a design →
  gallery retention → quota → Stripe **test** checkout → webhook → cancellation email.

### Phase 7 — Promotion workflow (the payoff)
- Establish the documented flow: **change → prove in staging → promote same artifact/config to live.**
  Concretely: same git branch, build once, deploy image + hosting to staging first; after sign-off,
  deploy the identical build to the live project. I'll add this to `RUNBOOK.md`.

---

## 3. Repo changes this introduces (staging-only, live-safe)
- New `infra/envs/staging/` (additive — does not touch `infra/envs/nonprod/`).
- Parameterize `api/cloudbuild.yaml` `_IMAGE_BASE` / secret path (via substitutions, so live still works).
- `.env.local.staging`, staging `.firebaserc`/`firebase.json` targets.
- A build-time switch for GA4/Stripe-price/theme so one codebase serves both envs cleanly.
- `RUNBOOK.md` promotion + rollback section for two environments.
- **No change to any live resource.** Live is a separate GCP project; nothing in Phase 1–7 deploys to it.

---

## 4. Rough cost
At your traffic, staging idles cheap: Cloud Run `min-instances=1` on 2 services is the main line item
(≈ a few $/month each at 1 CPU / 512Mi–1Gi), plus negligible Firestore/Storage/Artifact Registry.
To cut it further we can set `min-instances=0` in staging (cold starts, fine for a test env).
Estimate: **~$10–25/month** idle. I'll confirm once it's up.

---

## 5. Open confirmations for you
- D1–D7 above (region, Stripe test, domain, landing, data, analytics, sender).
- Whether you'll create the GCP project yourself or grant me `projectCreator` to script it.
- Shopify dummy-token OK (item 9).
