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
| api image | v15 (rev api-00020-256) | v14 (rev api-00019-d54) |
| stripe-webhook image | v15 (rev stripe-webhook-00012-c56) | v14 (rev stripe-webhook-00011-zkg) |

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
