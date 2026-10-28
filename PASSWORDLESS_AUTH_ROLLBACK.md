# Passwordless email sign-in — rollback card

New accounts sign in with an email link instead of a password; existing password
users keep their passwords. Verified in staging (2026-10-28) before promotion.

---

# PRODUCTION (`prhomzmvp-nonprod` / designer.prhomzai.com)

## State captured before the change — 2026-10-28

| Thing | Value at capture |
|---|---|
| Git branch | `main`, clean, in sync with `origin/main` |
| Git revert tag | **`pre-passwordless-prod`** → commit `4ef6c86` |
| Cloud Run `api` revision | **`api-00025-wn2`** |
| Cloud Run `api` image | `us-central1-docker.pkg.dev/prhomzmvp-nonprod/api/api:v20` |
| Frontend bundle | `assets/main-BbP5QfAJ.js` (v1.2.0 PWA launch build) |
| Identity Platform `signIn.email` | `{"enabled": true, "passwordRequired": true}` — password only |
| Auth email sending | `CUSTOM_SMTP` — SendGrid, `noreply@prhomzai.com` |

`api` env vars set at capture. Terraform does **not** manage these values, so a
`terraform apply` clears them — this list is the record:

```
GALLERY_BUCKET=prhomzmvp-nonprod-gallery
GOOGLE_CLOUD_PROJECT=prhomzmvp-nonprod
PROCESS_TYPE=api
GEOFENCE_ENABLED=true
EXPECTED_AUDIENCE_OPTIONAL=true
```
Secrets (unchanged): `GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, `SHOPIFY_ACCESS_TOKEN`.

Note production deliberately does **not** set `REMODEL_IMAGE_MODEL` or
`REMODEL_AGENT` — the Nano-Banana-Pro and orchestrator work remains staging-only
and this change does not alter that.

## Revert levers, cheapest first

### 1. Instant off-switch — no deploy, no build (seconds)

With the flag removed the gate refuses link requests and the frontend falls back
to the password form automatically. This works even against a browser still
running the passwordless bundle, so it is the first thing to reach for.

```sh
gcloud run services update api \
  --project prhomzmvp-nonprod --region us-central1 \
  --remove-env-vars PASSWORDLESS_AUTH
```
Re-enable with `--update-env-vars PASSWORDLESS_AUTH=on`.

**Caveat:** anyone mid-flow who already has a link in their inbox can still use
it — the link is issued by Identity Platform, not by us. To stop links working
at source as well, also do lever 4.

### 2. Roll the API image back (~1 min)

```sh
gcloud run services update-traffic api \
  --project prhomzmvp-nonprod --region us-central1 \
  --to-revisions api-00025-wn2=100
```

### 3. Roll the frontend back (~1 min)

```sh
cd ~/PRHOMZ-AI-DESIGNER
npx firebase-tools hosting:rollback --project prhomzmvp-nonprod
```
Target bundle is `assets/main-BbP5QfAJ.js`. Confirm by viewing source on
designer.prhomzai.com. Firebase Hosting console offers the same one-click revert.

### 4. Turn the provider off at source

Stops any new link being issued, and invalidates the flow for links already sent.
Password sign-in is unaffected either way.

```sh
P=prhomzmvp-nonprod
curl -s -X PATCH \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "x-goog-user-project: $P" -H "Content-Type: application/json" \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/$P/config?updateMask=signIn.email.passwordRequired" \
  -d '{"signIn":{"email":{"passwordRequired":true}}}'
```
`passwordRequired: true` restores the captured state. Console equivalent:
Authentication → Sign-in method → Email/Password → untick *Email link*.

### 5. Roll the code back

```sh
cd ~/PRHOMZ-AI-DESIGNER
git reset --hard pre-passwordless-prod      # discards the promotion commit
```
Or keep history: `git revert <promotion commit>`.

### Full restore, in order

If you want production exactly as it was: lever 4 (provider off) → lever 1 (flag
off) → lever 2 (API image) → lever 3 (frontend) → lever 5 (code). Levers 1–4 are
independent, so you can stop as soon as the symptom clears.

## What is NOT reverted by any lever

Accounts created through the passwordless flow still exist, and have no
`firstName`/`lastName`/`gender`/`ageRange`/`zipCode`/`country`. They sign in by
password reset if the provider is turned off. Reverting the code does not
backfill those fields — there is nothing to backfill them from.

---

# STAGING (`prhomzmvp-staging-505019`)

Built and verified here first. Deployed state: commit `3f874ca`, tag
`passwordless-v1`, api image `v16` / revision `api-00021-4lj`, bundle
`main-CsTTygnA.js`, build badge `261028-0942`. Revert tag `pre-passwordless`
(`64a045b`). Same five levers, substituting the staging project, region
`us-central1`, prior revision `api-00020-tml` and prior image `v15`.

Staging sends auth email via Firebase's **default** sender, production via
SendGrid (`noreply@prhomzai.com`). Staging is therefore the harsher delivery
test, not a weaker one.

---

# Data written by this feature

| Collection | Doc id | Purpose | Safe to delete? |
|---|---|---|---|
| `authRateLimits` | `ip:<sha256>` / `email:<sha256>` | fixed-window abuse counters | yes, counters only |
| `emailConsents` | `<sha256(email)>` | Terms + Privacy acceptance record | **no — legal record** |

Both are new collections; nothing pre-existing reads or writes them. The
catch-all `allow read, write: if false` in `firestore.rules` already denies all
client access, so no rules change was needed. IPs and email addresses appear in
`authRateLimits` only as SHA-256 hashes.

# Abuse controls

- Throwaway-domain blocklist (`api/src/lib/disposableDomains.ts`). Consumer
  providers — gmail, hotmail, outlook, live, yahoo, icloud, proton, gmx, zoho —
  are deliberately absent and must never be added.
- 5 link requests per hour per address; 10 per hour per IP. A request refused by
  the per-email rule does not consume the per-IP allowance, so one person
  retrying cannot lock out others behind the same IP.
- The gate is bypassable by calling the Firebase SDK directly; Identity
  Platform's own project quotas are the backstop. Accepted deliberately.
