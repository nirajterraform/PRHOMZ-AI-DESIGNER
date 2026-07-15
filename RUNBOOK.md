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
| api image | v13 (rev api-00018-w4j) | v12 (rev api-00017-px9) |
| stripe-webhook image | v12 (rev stripe-webhook-00010-m4g) | stripe-webhook-00009-mzw |

---

## Scheduled jobs (Cloud Scheduler)

| Job | Schedule (UTC) | Hits |
|---|---|---|
| expire-old-images | hourly | `/internal/expireOldImages` |
| hard-delete-accounts | daily 03:30 | `/internal/hardDeleteExpiredAccounts` |
