# Infrastructure Plan & Design — PRHOMZ AI Designer

**Environment:** Dev (`prhomz-dev-code-test`)
**Region:** `us-central1` (Iowa)
**Cloud:** Google Cloud Platform (Firebase)
**Provisioning:** Terraform — code lives in `infra/` at the project root
**Last updated:** 2026-05-14

---

## 1. Purpose

This document describes the cloud infrastructure provisioned by Terraform for the PRHOMZ AI Designer rebuild. It covers **what** each resource is, **why** it's there, and **how much** it costs. The audience is anyone reviewing the deployment — engineers, project owners, or stakeholders signing off on cloud spend.

Application code (React frontend, Cloud Function source) is **not** in scope here. This is the platform layer only.

---

## 2. Environment Overview

| Attribute              | Value                                  |
|------------------------|----------------------------------------|
| GCP Project ID         | `prhomz-dev-code-test`                 |
| Project Number         | `155998713674`                         |
| Billing Account        | `01D29D-05A264-503401`                 |
| Primary region         | `us-central1`                          |
| Terraform state        | GCS bucket `prhomz-designer-dev-tfstate` (versioned) |
| Total resources        | 42 (created by Terraform)              |
| Identity model         | End-users via Firebase Auth; operators via GCP IAM (separate systems) |

---

## 3. Resource Inventory

### 3.1 Core Services

| Resource                          | Terraform                              | Purpose                                                                 |
|-----------------------------------|----------------------------------------|-------------------------------------------------------------------------|
| Firebase project link             | `google_firebase_project.default`      | Enables Firebase features (Auth, Hosting, Storage SDK) on the GCP project. Without this, the project is a plain GCP project with no Firebase capability. |
| Firebase Web App                  | `google_firebase_web_app.default`      | The "client identity" for the React app — provides the `apiKey`, `appId`, `authDomain` values that the frontend uses to talk to Firebase services. |
| Identity Platform config          | `google_identity_platform_config.default` | The end-user authentication service. Configured for email + password sign-in. Email verification is enforced by application code, not by this resource. |
| Firestore Native database         | `google_firestore_database.default`    | The primary application database. Stores user profiles, subscription state, gallery metadata, product recommendations, Stripe event logs. Point-in-time recovery enabled. **Region is permanent once created.** |

### 3.2 Data Layer

| Resource                          | Terraform                              | Purpose                                                                 |
|-----------------------------------|----------------------------------------|-------------------------------------------------------------------------|
| Gallery storage bucket            | `google_storage_bucket.gallery` (`prhomz-dev-code-test-gallery`) | Stores AI-generated images (full size + thumbnails). Uniform IAM, public access blocked, 30-day lifecycle delete as a safety net. |
| Firebase Storage binding          | `google_firebase_storage_bucket.gallery` | Registers the GCS bucket with Firebase Storage so the Firebase SDK can talk to it from the client. |
| CORS rules on bucket              | inside `storage.tf`                    | Allows browser uploads from any origin during dev. Will be narrowed to the production domain in Phase 7. |

### 3.3 Secrets

| Resource                              | Terraform                                            | Purpose                                                                 |
|---------------------------------------|------------------------------------------------------|-------------------------------------------------------------------------|
| Secret: `gemini-api-key`              | `google_secret_manager_secret.gemini_api_key`        | Holds the Google Gemini API key, used by Cloud Functions to call the AI service. Never exposed to the browser. |
| Secret: `shopify-access-token`        | `google_secret_manager_secret.shopify_access_token`  | Holds the Shopify Admin API token for product inventory lookups. |
| Secret: `stripe-secret-key`           | `google_secret_manager_secret.stripe_secret_key`     | Holds the Stripe secret key for Checkout and Portal session creation. |
| Secret: `stripe-webhook-secret`       | `google_secret_manager_secret.stripe_webhook_secret` | Holds the Stripe webhook signing secret to verify incoming events. |

The Terraform creates the **secret resources only** — the actual values are uploaded separately via `gcloud secrets versions add` so they never enter the Terraform state file.

### 3.4 Security & IAM

| Resource                                                | Terraform                                             | Purpose                                                                 |
|---------------------------------------------------------|-------------------------------------------------------|-------------------------------------------------------------------------|
| Service Account: `functions-runtime@…`                  | `google_service_account.functions_runtime`            | The identity that Cloud Functions will run as. Scoped permissions only — no broad admin. |
| Role binding: Datastore User                            | `google_project_iam_member.functions_firestore`       | Lets Functions read/write Firestore (user docs, gallery, Stripe events). |
| Role binding: Storage Object Admin (gallery bucket only)| `google_storage_bucket_iam_member.functions_gallery_admin` | Lets Functions upload/delete generated images. Bucket-scoped — not project-wide. |
| Role bindings: Secret Accessor (×4)                     | `google_secret_manager_secret_iam_member.functions_*` | Per-secret access for the runtime SA. Each secret is bound individually for least-privilege. |
| Role binding: Firebase Auth Admin                       | `google_project_iam_member.functions_auth_admin`      | Lets Functions read user records and set custom claims (e.g. tier) at signup. |
| Role binding: Log Writer                                | `google_project_iam_member.functions_log_writer`      | Lets Functions write to Cloud Logging for observability. |

### 3.5 Enabled GCP APIs

23 APIs are enabled via `google_project_service` resources. Grouped by purpose:

| Group        | APIs                                                                                            | Why                                              |
|--------------|-------------------------------------------------------------------------------------------------|--------------------------------------------------|
| Bootstrap    | `cloudresourcemanager`, `serviceusage`, `iam`, `iamcredentials`                                 | Required by Terraform to manage other resources. |
| Firebase     | `firebase`, `firebaserules`, `firebasestorage`, `identitytoolkit`                               | Firebase core services.                          |
| Data         | `firestore`, `storage`, `storage-api`, `storage-component`                                      | Database + object storage.                       |
| Compute      | `cloudfunctions`, `cloudbuild`, `run`, `eventarc`, `pubsub`, `cloudscheduler`, `artifactregistry` | Cloud Functions 2nd gen runs on Cloud Run; needs all of these. |
| Security     | `secretmanager`                                                                                 | Secret storage.                                  |
| Observability| `logging`, `monitoring`                                                                         | Logs and metrics.                                |
| Billing      | `cloudbilling`                                                                                  | Lets Terraform read billing info if needed.      |

### 3.6 Outputs (Reference)

Terraform emits these values for use elsewhere:

- `project_id`, `region`
- `gallery_bucket` — name of the storage bucket
- `firestore_database` — Firestore database name (`(default)`)
- `functions_runtime_sa` — email of the runtime service account
- `firebase_web_app_id` — for the frontend `firebase.initializeApp` call
- `firebase_web_config` — the full SDK config blob (sensitive)
- `secret_ids` — the four secret resource IDs

---

## 4. Cost Estimate

Costs are in USD/month and are **estimates** based on GCP's published pricing for `us-central1`. Real spend depends on usage. **The Gemini API itself is billed separately by Google AI and is not part of this infrastructure cost.**

### 4.1 Free Tier Coverage

Most of what we provision sits inside the free tier at dev scale:

| Service               | Free tier (per month)                              |
|-----------------------|----------------------------------------------------|
| Firestore             | 1 GiB storage, 1.5M reads, 600K writes, 600K deletes |
| Cloud Storage         | 5 GB storage, 5K Class-A ops, 50K Class-B ops, 1 GB egress |
| Cloud Functions       | 2M invocations, 400K GB-sec compute, 200K GHz-sec  |
| Firebase Auth         | 50K monthly active users (email/password)          |
| Cloud Scheduler       | 3 jobs                                             |
| Pub/Sub               | 10 GB messages                                     |
| Logging / Monitoring  | 50 GB logs, basic metrics                          |
| Artifact Registry     | 0.5 GB storage                                     |

### 4.2 Monthly Cost by Stage

| Stage                                              | Estimated cost            |
|----------------------------------------------------|---------------------------|
| **Idle dev** (nothing running, infra alone)        | **~$0.30 – $0.50 / month** |
| **Active dev** (engineer testing, light usage)     | **~$1 – $3 / month**       |
| **Pilot (100 active users, mostly Freemium)**      | **~$3 – $8 / month**       |
| **Small launch (1,000 active users, mixed tiers)** | **~$15 – $40 / month**     |
| **Scale (10,000 active users)**                    | **~$150 – $400 / month**   |

These are conservative ranges. Optimistic with caching/CDN: less. Pessimistic with heavy power-users: more.

### 4.3 Per-Resource Cost Breakdown (Idle Dev → Pilot)

| Resource                           | Idle dev      | Pilot (100 users)   | Notes |
|------------------------------------|---------------|---------------------|-------|
| Firestore (storage + ops)          | $0            | $0 – $1             | Free tier covers everything until tens of thousands of ops/day. |
| Cloud Storage (gallery bucket)     | $0 – $0.10    | $0.20 – $1          | 7-day retention keeps the working set small. Standard class pricing $0.020/GB/month. |
| Secret Manager (4 secrets)         | $0.24         | $0.24               | Flat $0.06 per active version per month. Negligible. |
| Cloud Functions (2nd gen / Cloud Run) | $0          | $0 – $1             | Well within 2M invocations free tier at this scale. |
| Firebase Auth (Identity Platform)  | $0            | $0                  | Free up to 50K MAU. Past that: $0.0055/user/month. |
| Pub/Sub + Eventarc                 | $0            | $0                  | Within free tier.                                  |
| Cloud Logging                      | $0            | $0                  | Within 50 GB free tier.                            |
| Artifact Registry (Function images)| $0 – $0.05    | $0 – $0.10          | Function container images, small.                  |
| GCS state bucket (Terraform)       | $0.01         | $0.01               | A few KB of state.                                 |
| Cloud Scheduler                    | $0            | $0                  | Free up to 3 jobs.                                 |
| Network egress (browser downloads) | $0            | $0 – $2             | Free tier 1 GB; beyond: $0.12/GB to internet.      |
| **Total infra**                    | **~$0.30 – $0.50** | **~$1 – $5**   | Excludes Gemini AI calls.                          |

### 4.4 Costs NOT Included Here

These are real costs but live outside this Terraform stack:

| Item                              | Approximate cost                                  |
|-----------------------------------|---------------------------------------------------|
| Google Gemini API (image gen)     | **~$0.04 per image** for `gemini-2.5-flash-image`. Dominant variable cost at scale. |
| Google Gemini API (text)          | ~$0.30 per million input tokens, ~$2.50 per million output tokens for Pro models. |
| Stripe fees                       | 2.9% + $0.30 per successful card charge.          |
| Domain registration / DNS         | $10 – $15 / year, registrar-dependent.            |
| Email sending (verification, receipts) | Free up to a few thousand/day via Firebase default; SendGrid ~$15/mo for custom branding. |
| GCP support plan                  | Basic (free) is fine for dev. Standard is $29/month if needed later. |

---

## 5. Cost Controls

Defensive measures already baked into the infra:

| Control                                      | Where                                                          |
|----------------------------------------------|----------------------------------------------------------------|
| 30-day GCS lifecycle delete                  | `storage.tf` — caps storage growth even if Functions fail.     |
| Bucket public access blocked                 | `storage.tf` — prevents drive-by abuse via hot-linking.        |
| Per-secret IAM bindings                      | `iam.tf` — Functions can only read the 4 secrets, nothing else.|
| Storage Object Admin scoped to gallery bucket| `iam.tf` — Functions cannot touch other buckets if added later.|
| `disable_on_destroy = false` on APIs         | `apis.tf` — accidentally `terraform destroy` doesn't disrupt other workloads. |

Recommended follow-ups (not in Terraform yet, but advised):

- **GCP Billing Budget alerts** — set at $10, $25, $50 thresholds in the GCP console.
- **Firebase App Check** — Phase 7. Blocks bot traffic from hitting Functions.
- **Cloud Armor** — only if scaling past 1K users and seeing abuse.
- **Per-user monthly quotas** in Functions code — already in the implementation plan (`monthlyDesignCount` + `monthlyResetAt`).

---

## 6. What's Intentionally Excluded

We are *not* provisioning these via Terraform, by design:

| Item                          | Why excluded                                                                  |
|-------------------------------|-------------------------------------------------------------------------------|
| Cloud Function source code    | App code; deployed separately via `firebase deploy --only functions`.         |
| Secret values                 | Added via `gcloud secrets versions add` so values never enter state file.     |
| Firebase Hosting site config  | Auto-provisioned when Firebase is enabled; deployed via Firebase CLI.         |
| App Check / reCAPTCHA Enterprise key | Requires human verification in the console; will be added in Phase 7. |
| Stripe products / prices      | Configured in the Stripe dashboard, not GCP.                                  |
| Production project            | Dev only for now; prod project is a future copy with different `tfvars`.      |

---

## 7. Security Posture

- **No checked-in secrets.** `terraform.tfvars` is gitignored. Secret *values* are not in Terraform state.
- **No project-level admin grants.** The Functions runtime SA has only the roles it needs, mostly scoped to single resources.
- **Public access blocked on the bucket.** End users access images via short-lived signed URLs or via the Firebase SDK with auth tokens — never via direct public URLs.
- **End-user auth lives in Firebase Auth.** End users are not part of GCP IAM. GCP IAM is purely the admin/operator plane.
- **TLS everywhere.** All Google service endpoints are HTTPS by default.

---

## 8. Deployment & Tear-Down

### Deploy

```bash
cd infra
terraform init
terraform plan      # review ~42 resources
terraform apply     # type "yes"
```

After successful apply:
1. Visit `https://console.firebase.google.com/project/prhomz-dev-code-test` and accept Firebase Terms of Service (one-time).
2. Upload secret values: `gcloud secrets versions add gemini-api-key --data-file=- --project=prhomz-dev-code-test`.
3. Capture the frontend config: `terraform output -json firebase_web_config`.

### Tear Down

```bash
terraform destroy
```

This removes everything Terraform created. It does **not** remove:
- The GCP project itself (created manually in the console).
- The Terraform state bucket (created manually).
- The billing link.

If you want to fully wipe the project, delete it from the GCP console after `terraform destroy`.

---

## 9. Open Items

| Item                                | Owner      | Phase   |
|-------------------------------------|------------|---------|
| Set GCP budget alerts ($10/$25/$50) | Niraj      | Phase 0 (post-apply) |
| Add real Gemini key to Secret Manager | Niraj    | Phase 0 (post-apply) |
| Add Stripe secrets when account live | Niraj     | Phase 4 |
| Enable Firebase App Check           | Niraj      | Phase 7 |
| Spin up a separate `prod` project   | Niraj      | Phase 7 |
| Custom domain + SSL on Firebase Hosting | Niraj  | Phase 7 |
