# Passwordless email sign-in — staging rollback card

**Scope: STAGING ONLY** (`prhomzmvp-staging-505019`). Production (`prhomzmvp-nonprod`,
designer.prhomzai.com) is not touched by any step below.

## State captured before the change (2026-10-28)

| Thing | Value at capture |
|---|---|
| Git branch | `staging` |
| Git revert tag | **`pre-passwordless`** → commit `64a045b` |
| Cloud Run `api` revision | **`api-00020-tml`** |
| Cloud Run `api` image | `us-central1-docker.pkg.dev/prhomzmvp-staging-505019/api/api:v15` |
| Frontend host | `prhomzmvp-staging-505019.web.app` |
| API base | `https://api-36mqr36owq-uc.a.run.app` |
| Identity Platform `signIn.email` | `{"enabled": true, "passwordRequired": true}` |

## State after the change

| Thing | Value |
|---|---|
| Commit | `f297d0c` |
| Cloud Run `api` revision | `api-00021-4lj` |
| Cloud Run `api` image | `…/api/api:v16` |
| Added env var | `PASSWORDLESS_AUTH=on` |
| Frontend bundle | `assets/main-CsTTygnA.js` |
| Build id (corner badge) | `261028-0942` |
| Identity Platform `signIn.email` | `{"enabled": true}` — `passwordRequired` absent = false, i.e. password **and** email-link both allowed |

`api` env vars set at capture (these are **not** managed by Terraform state for
values set by hand — a `terraform apply` clears them, so this list is the record):

```
GALLERY_BUCKET=prhomzmvp-staging-505019-gallery
GOOGLE_CLOUD_PROJECT=prhomzmvp-staging-505019
PROCESS_TYPE=api
GEOFENCE_ENABLED=false
EXPECTED_AUDIENCE_OPTIONAL=true
STRIPE_PRICE_BASIC=price_1TXKZtQvWrs0iL1QklCqzrEh
STRIPE_PRICE_ADVANCED=price_1TXKanQvWrs0iL1QCRgdf30v
STRIPE_PRICE_DESIGNER=price_1TXKbgQvWrs0iL1QAprPVviL
REMODEL_IMAGE_MODEL=gemini-3-pro-image
REMODEL_AGENT=on
```
Secrets (unchanged by this work): `GEMINI_API_KEY`, `STRIPE_SECRET_KEY`,
`SHOPIFY_ACCESS_TOKEN` — all `secret:latest`.

## Revert levers, cheapest first

### 1. Instant off-switch — no deploy, no build (seconds)

The server-side flag governs the whole feature. With it off, the gate endpoint
refuses link requests and the frontend automatically falls back to showing the
password form. This works even against a client bundle that still has the
passwordless UI compiled in.

```sh
gcloud run services update api \
  --project prhomzmvp-staging-505019 --region us-central1 \
  --remove-env-vars PASSWORDLESS_AUTH
```

Re-enable with `--update-env-vars PASSWORDLESS_AUTH=on`.

### 2. Roll the API image back (~1 min)

```sh
gcloud run services update-traffic api \
  --project prhomzmvp-staging-505019 --region us-central1 \
  --to-revisions api-00020-tml=100
```

### 3. Roll the frontend back (~1 min)

```sh
cd ~/PRHOMZ-AI-DESIGNER-staging
npx firebase-tools hosting:rollback --project prhomzmvp-staging-505019
```
Confirm by the build-id badge in the bottom-left corner changing back.

### 4. Roll the code back (git)

```sh
cd ~/PRHOMZ-AI-DESIGNER-staging
git reset --hard pre-passwordless     # discards the passwordless commits
```
Or keep history and revert the range:
```sh
git revert --no-commit pre-passwordless..HEAD && git commit -m "revert: passwordless auth"
```

### 5. Identity Platform provider

Turning the Email-link provider back off stops any link being issued at source.
Password sign-in is unaffected either way.

In the console: Authentication → Sign-in method → Email/Password → untick
*Email link (passwordless sign-in)*. Or by API:

```sh
PROJ=prhomzmvp-staging-505019
curl -s -X PATCH \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "x-goog-user-project: $PROJ" -H "Content-Type: application/json" \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJ/config?updateMask=signIn.email.passwordRequired" \
  -d '{"signIn":{"email":{"passwordRequired":true}}}'
```

`passwordRequired: true` restores the captured state (password only).
**This setting is per Firebase project — the production project was not touched.**

## Why production is safe if these commits are ever promoted

- The frontend path is gated on `VITE_PASSWORDLESS_AUTH`, a **build-time** flag.
  Production builds do not set it, so the passwordless UI does not render and the
  existing Create Account / Sign In screens are byte-identical in behaviour.
- The backend path is gated on `PASSWORDLESS_AUTH`. Production does not set it, so
  the gate endpoint refuses every request.
- The Email-link provider is enabled **per Firebase project**. Enabling it on
  staging has no effect on the production project.
- No existing route, middleware or password flow is modified. `handleOnSignup`
  gains a consent-stamp branch that only runs when a consent record exists —
  which only the new gate endpoint writes.

## Data written by the new code

| Collection | Doc id | Purpose | Safe to delete? |
|---|---|---|---|
| `authRateLimits` | `ip:<sha256>` / `email:<sha256>` | fixed-window abuse counters | yes, counters only |
| `emailConsents` | `<sha256(email)>` | T&C + Privacy acceptance record | **no** — legal record |

Both are new collections; nothing existing reads or writes them. IPs and emails
are stored only as SHA-256 hashes in `authRateLimits`.
