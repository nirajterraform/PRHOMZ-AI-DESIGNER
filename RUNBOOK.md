# PRHOMZ AI Designer — Production Runbook

Operational reference for deploys, rollbacks, and launch go/no-go.
Project: `prhomzmvp-nonprod` · Region: `us-central1`

> Shell note: this repo's environment exports `GOOGLE_IMPERSONATE_SERVICE_ACCOUNT`
> for a different project. **`unset GOOGLE_IMPERSONATE_SERVICE_ACCOUNT`** before
> any `gcloud`/`terraform` command here.

---

## Services

| Service | Type | URL | Custom domain |
|---|---|---|---|
| api | Cloud Run | https://api-lm4jlrh5qq-uc.a.run.app | — |
| stripe-webhook | Cloud Run | https://stripe-webhook-lm4jlrh5qq-uc.a.run.app | — |
| landing | Cloud Run | https://landing-lm4jlrh5qq-uc.a.run.app | `prhomzai.com` (pending) |
| app (designer) | Firebase Hosting | https://prhomzmvp-nonprod.web.app | `designer.prhomzai.com` ✅ |

---

## Deploy

**Backend (api / stripe-webhook)** — build once, deploy the image to each service:
```bash
unset GOOGLE_IMPERSONATE_SERVICE_ACCOUNT
gcloud builds submit --config api/cloudbuild.yaml \
  --substitutions=_IMAGE_TAG=vN --project=prhomzmvp-nonprod .
gcloud run deploy api            --image=us-central1-docker.pkg.dev/prhomzmvp-nonprod/api/api:vN --region=us-central1 --project=prhomzmvp-nonprod --quiet
gcloud run deploy stripe-webhook --image=us-central1-docker.pkg.dev/prhomzmvp-nonprod/api/api:vN --region=us-central1 --project=prhomzmvp-nonprod --quiet
```
The image bundles the GeoLite2 DB (downloaded in Cloud Build from the
`maxmind-license-key` secret). Env vars (e.g. `GEOFENCE_ENABLED`) are managed in
Terraform `cloud_run.tf`; `--image`-only deploys preserve them.

**Frontend (app)**:
```bash
npx vite build
npx firebase-tools deploy --only hosting --project prhomzmvp-nonprod
```

**Infra (Terraform)** — from `infra/envs/nonprod`, after `unset`:
```bash
terraform plan     # ALWAYS review; watch for image/env changes on Cloud Run
terraform apply
```

---

## Monthly maintenance — refresh the MaxMind GeoLite2 DB (checklist §6.10)

**Why:** the GeoLite2-Country DB that powers the US-only Shop-the-Look geofence is
**baked into the api image at build time**. MaxMind updates it ~weekly; country-level
IP data drifts slowly, so a **monthly** refresh is ample. Left unrefreshed it only
causes occasional mis-geolocation, and the geofence **fails open**, so this is
low-urgency housekeeping — not a hard dependency.

**Cadence:** once a month (e.g. the 1st). Set a recurring calendar reminder.

**Procedure** (rebuild api with a fresh DB, then deploy — same as a normal backend deploy;
the Cloud Build step re-downloads the latest DB from the `maxmind-license-key` secret):
```bash
cd /Users/nirajsriwastava/PRHOMZ-AI-DESIGNER
unset GOOGLE_IMPERSONATE_SERVICE_ACCOUNT
# Use the next version tag (bump N from the rollback table below):
gcloud builds submit --config api/cloudbuild.yaml \
  --substitutions=_IMAGE_TAG=vN --project=prhomzmvp-nonprod .
gcloud run deploy api            --image=us-central1-docker.pkg.dev/prhomzmvp-nonprod/api/api:vN --region=us-central1 --project=prhomzmvp-nonprod --quiet
gcloud run deploy stripe-webhook --image=us-central1-docker.pkg.dev/prhomzmvp-nonprod/api/api:vN --region=us-central1 --project=prhomzmvp-nonprod --quiet
```
**Verify** the geofence still resolves after deploy:
```bash
curl -s https://api-lm4jlrh5qq-uc.a.run.app/geo   # returns {country, shopEnabled}
```
Then update the rollback table below with the new `vN` / revisions.

> **Full automation deferred:** an unattended Cloud Scheduler→Cloud Build pipeline that
> auto-**redeploys** the core api was intentionally NOT set up — the risk of an
> unattended auto-deploy of the main service outweighs the small benefit of a slightly
> fresher country DB (which fails open). Revisit post-launch if desired (requires a
> source-connected build trigger).

---

## 11.2 Rollback

### Backend — re-route traffic to the previous revision (instant, no rebuild)
```bash
unset GOOGLE_IMPERSONATE_SERVICE_ACCOUNT
# List revisions, newest first:
gcloud run revisions list --service=api --region=us-central1 --project=prhomzmvp-nonprod
# Send 100% traffic to a known-good revision:
gcloud run services update-traffic api --region=us-central1 --project=prhomzmvp-nonprod \
  --to-revisions=REVISION_NAME=100
```
Same for `stripe-webhook`. This is the fastest recovery — seconds, no build.

### Frontend — Firebase Hosting keeps prior releases
```bash
npx firebase-tools hosting:rollback --project prhomzmvp-nonprod
```
Or roll back to a specific version from the Hosting console → Release history.

### Code — revert the commit
```bash
git revert <sha>          # safe: creates an undo commit
git push origin main
# then redeploy (build + deploy steps above)
```

### Env / feature flags — instant, no redeploy
```bash
# e.g. disable Shop the Look geofencing:
gcloud run services update-env-vars api --region=us-central1 --project=prhomzmvp-nonprod \
  --update-env-vars=GEOFENCE_ENABLED=false
```

---

## 11.3 Safe deploys — pin traffic, don't auto-route a broken build

Deploy the new revision **without** sending traffic, verify it, then flip:
```bash
# 1. Deploy but keep 100% on the current revision:
gcloud run deploy api --image=...:vN --region=us-central1 --project=prhomzmvp-nonprod --no-traffic --quiet
# 2. Grab the new revision name from the output, smoke-test it via its revision URL.
# 3. Flip traffic once satisfied:
gcloud run services update-traffic api --region=us-central1 --project=prhomzmvp-nonprod --to-latest
# (or split, e.g. --to-revisions=NEW=10,CURRENT=90 for a canary)
```
Use this for any risky backend change so a bad build never serves users.

---

## 11.4 Launch-day go / no-go criteria

Flip DNS to production **only if ALL of these pass** (see checklist §12 smoke test):

- [ ] New signup → verification email lands in **inbox** (not spam), branded link
- [ ] Verified user can generate a design (free render decrements quota)
- [ ] Upgrade to Basic via **live** Stripe → tier updates within ~1 min (webhook)
- [ ] Customer Portal opens → cancel → tier reverts at period end
- [ ] Gallery shows render; Shop the Look works (US) / blocks (non-US)
- [ ] Delete account → soft-deleted, signed out, cannot sign back in
- [ ] Mobile (iPhone Safari + Android Chrome): core flows work
- [ ] Landing → "Designer" link routes to `designer.prhomzai.com`
- [ ] Uptime checks green; no firing alerts; Cloud Trace receiving spans

**No-go** if any of: verification email → spam, webhook not updating tier, live
payment fails, or a P0 JS error on signup/generate. Roll back per §11.2.

---

## Key rollback reference points (update on each deploy)

| Component | Current | Previous (rollback) |
|---|---|---|
| api image | v20 (rev api-00025-wn2) | v19 (rev api-00024-zfv) |
| stripe-webhook image | v20 (rev stripe-webhook-00019-4dd) | v19 (rev stripe-webhook-00018-hf7) |
| designer frontend (Hosting app) | v1.2.0 PWA/mobility (git `9eedba4`, bundle `main-BbP5QfAJ.js`) | v1.1.0 blue brand (git `b39bf97`, `main-BUBBWikQ.js`) — `npx firebase-tools hosting:rollback` |
| landing image (Cloud Run `landing`) | v15 (rev landing-00026-voq) | v14 (rev landing-00023-tg8) |

> **✅ v1.2.0 PWA / MOBILITY PRODUCTION LAUNCH (2026-08-22):** designer app is now an
> **installable PWA** (vite-plugin-pwa: manifest + `autoUpdate` service worker + icons incl.
> maskable). Adds: always-visible **"Install app"** button (login + header; native prompt on
> Android/desktop, per-browser steps otherwise), **iOS guided Add-to-Home-Screen banner** +
> `apple-mobile-web-app` full-screen meta, **in-app camera** (getUserMedia, orientation-stable on
> iOS) replacing the flaky OS capture, **room-type custom dropdown** (native `<select>` was
> unreliable on iPhone), and signup **default country "United States"** + pinned common countries.
> `firebase.json` gained `no-cache` headers for `sw.js`/`registerSW.js`/`workbox-*.js`/`manifest`.
> **Frontend-only** — landing + backend untouched. Built `VITE_THEME=brand` → `firebase deploy
> --only hosting:app`. Repo tagged `v1.2.0` (git `9eedba4`). **Rollback:** `npx firebase-tools
> hosting:rollback` (instant → v1.1.0 `main-BUBBWikQ.js`), or Firebase console → Release history.
> Existing users get the new version automatically via the service worker on next load.

> **✅ v1.1.0 BLUE BRAND PRODUCTION LAUNCH (2026-08-11):** designer redesigned to the blue brand + stakeholder feedback (wordmark=Georgia italic, quota-reached upgrade card, red Renders pill, Shop-the-Look mobile new-tab, room-type dropdown, etc.) → built `VITE_THEME=brand` → `firebase deploy --only hosting:app`. Landing (`prhomzai.com`) updated: "How it works" boxes link to designer.prhomzai.com (new tab; demos preserved via stopPropagation) + membership synced to app (Freemium 30). Repos tagged `v1.1.0` (designer + landing). **Rollback:** designer → `npx firebase-tools hosting:rollback` (or Hosting console); landing → `gcloud run services update-traffic landing --to-revisions=landing-00023-tg8=100 --region us-central1`. Preview channels `green-design`/`brand-design` intentionally KEPT for the PWA/mobility round.

> **v19–v20 (2026-08-06):** quota changes in `shared/tiers.ts` (backup `shared/tiers.ts.bak.quota` = pre-change state). v19: freemium daily→unlimited, monthly 10→30. v20: basic daily 5→unlimited (monthly 100 kept). **Revert:** restore the backup → rebuild → redeploy api+stripe-webhook to the previous images above, OR rebuild a fresh tag with reverted config.

> **✅ Terraform reconciled (2026-07-24):** the SendGrid env/secret/IAM and the alert-channel
> changes are now codified. `sendgrid-api-key` secret + `runtime_sendgrid` IAM + `SENDGRID_API_KEY`
> env are in `secrets.tf`/`iam.tf`/`cloud_run.tf`; the two new channels (`prhomzai.alert`, Arun)
> were added to `alert_emails` and **imported** into state (so are the secret + IAM). A verified
> `terraform plan` shows **0 to add, 0 to destroy, ~12 in-place changes** — all benign: channel
> display-name normalization ("PRHOMZ AI Alerts" → "Email - prhomzai.alert@gmail.com"), alert-policy
> channel **reordering** (same 3 channels, no coverage lost), removal of default `scaling`/`phone_number`/
> `multi_tenant` blocks (pre-existing drift; does NOT touch SendGrid SMTP or authorized domains).
> **Safe to `terraform apply`.** Note: `prhomzai.finance` channel is intentionally NOT in `alert_emails`
> (reserved for the billing budget, not operational alerts).

---

## Email deliverability (SendGrid) — known issue + procedures

Firebase Auth verification / reset emails send via **SendGrid** from `noreply@prhomzai.com`.
A verified user must have Firebase Auth `emailVerified=true` to log in (gate in `App.tsx`:
`if (!authUser || !authUser.emailVerified)`).

### ⚠️ Incident 2026-08-16 — Microsoft (Hotmail/Outlook/Live) blocking our emails
**Symptom:** user `swapnil_c@hotmail.com` never received the verification email → could not log in.

**Root cause (confirmed via SendGrid suppression + Email Activity):** Microsoft **hard-rejected**
the mail (not spam-foldered) — SendGrid's **shared sending IP `149.72.120.130`** is on Microsoft's
block list:
```
550 5.7.1 ... messages from [149.72.120.130] weren't sent ... on our block list (S3140)
```
Both attempts logged `not_delivered`; the address was auto-added to SendGrid's **blocks** suppression
list (so SendGrid stops retrying). Affects **all** Microsoft-domain recipients (hotmail/outlook/live/msn),
not just one user. Gmail etc. unaffected — which is why it went unnoticed.

**Contributing factor we control:** `prhomzai.com` has **no SPF record** (DKIM ✅ via SendGrid CNAMEs
`s1/s2._domainkey`; DMARC exists but `p=none`, `rua` → GoDaddy default mailbox). Missing SPF weakens
Microsoft standing.

**Immediate fix applied:** manually set `emailVerified=true` for the affected account (see procedure
below) so the user could log in without the email.

**Pending remediation (systemic — do these to actually fix Microsoft delivery):**
- [ ] **Add SPF** TXT on `prhomzai.com` (GoDaddy DNS): `v=spf1 include:sendgrid.net ~all`
      (add `include:zoho.com` if Zoho also sends mail — a `zoho-verification` TXT exists on the domain).
- [ ] **SendGrid support ticket** to delist shared IP `149.72.120.130` from Microsoft (S3140) / move to a clean IP.
- [ ] Remove affected addresses from SendGrid **blocks** suppression list once IP is clean.
- [ ] Enroll domain/IP in **Microsoft SNDS + JMRP**; consider a **dedicated IP** (with warm-up) if MS volume matters.
- [ ] After SPF+DKIM aligned, tighten **DMARC** to `p=quarantine` with a monitored `rua`.

### Procedure — manually verify a user's email (unblock login without the email)
Read-only lookup + the admin update use the Identity Toolkit API with the caller's gcloud token.
**Note the `x-goog-user-project` header** — required, else 403 `accessNotConfigured`.
```bash
unset GOOGLE_IMPERSONATE_SERVICE_ACCOUNT
TOKEN=$(gcloud auth print-access-token)
PROJECT=prhomzmvp-nonprod
LOCALID=<firebase-auth-uid>          # NOT the shell-reserved name UID
BASE="https://identitytoolkit.googleapis.com/v1/projects/$PROJECT"
H=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "x-goog-user-project: $PROJECT")
# confirm current state:
curl -s -X POST "$BASE/accounts:lookup" "${H[@]}" -d "{\"localId\":[\"$LOCALID\"]}"
# set verified:
curl -s -X POST "$BASE/accounts:update" "${H[@]}" -d "{\"localId\":\"$LOCALID\",\"emailVerified\":true}"
```
Find a user's uid by email: `npx firebase-tools auth:export tmp.json --format=json --project prhomzmvp-nonprod`
then grep (delete the export after — it contains PII/password hashes).

### Diagnose deliverability for an address (SendGrid — key stays server-side, never echo it)
```bash
KEY=$(gcloud secrets versions access latest --secret=sendgrid-api-key --project=prhomzmvp-nonprod)
for L in bounces blocks invalid_emails spam_reports; do
  echo "== $L =="; curl -s -H "Authorization: Bearer $KEY" "https://api.sendgrid.com/v3/suppression/$L/<email>"; echo
done
# recent activity (if Email Activity is enabled on the plan):
curl -s -H "Authorization: Bearer $KEY" "https://api.sendgrid.com/v3/messages?query=to_email%3D%22<email>%22&limit=10"
```

---

## Scheduled jobs (Cloud Scheduler)

| Job | Schedule (UTC) | Hits |
|---|---|---|
| expire-old-images | hourly | `/internal/expireOldImages` |
| hard-delete-accounts | daily 03:30 | `/internal/hardDeleteExpiredAccounts` |

---

## Firestore backups & restore (checklist §5.6)

**Automated:** a **daily backup schedule** with **7-day retention** runs on the
`(default)` database (managed in Terraform `firestore.tf`). No manual action needed for
routine backups. Backups are managed snapshots (not GCS files).

**List schedules & backups:**
```bash
unset GOOGLE_IMPERSONATE_SERVICE_ACCOUNT
gcloud firestore backups schedules list --database="(default)" --project=prhomzmvp-nonprod
gcloud firestore backups list --project=prhomzmvp-nonprod
```

**Restore from a backup (incident recovery).** Firestore restores into a **NEW**
database (it cannot overwrite `(default)` in place) — restore, verify, then repoint the
app's `VITE_FIREBASE_*` / server config at the restored DB (or migrate data back):
```bash
gcloud firestore databases restore \
  --source-backup=projects/prhomzmvp-nonprod/locations/us-central1/backups/<BACKUP_ID> \
  --destination-database=restored-YYYYMMDD \
  --project=prhomzmvp-nonprod
```

**Manual on-demand export to GCS** (for longer-than-7-day retention, or a portable copy
before a risky migration). Needs a GCS bucket; the Firestore service agent must have
`roles/datastore.importExportAdmin` + object write on the bucket:
```bash
gcloud firestore export gs://prhomzmvp-nonprod-gallery/firestore-exports/$(date +%Y%m%d) \
  --project=prhomzmvp-nonprod
# Re-import (into a fresh/empty DB) with: gcloud firestore import gs://.../<path>
```

**Retention note:** managed backups keep **7 days**. For compliance/longer retention,
run the manual GCS export on a monthly cadence (alongside the §6.10 MaxMind refresh).
