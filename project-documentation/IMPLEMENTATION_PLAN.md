# PRHOMZ AI Designer — Production Hardening Implementation Plan

**Status:** Approved scope, ready to execute
**Owner:** Niraj
**Target stack:** Firebase (Auth, Firestore, Storage, Functions) on GCP + Stripe
**Last updated:** 2026-05-14

---

## 1. Confirmed Decisions

| Decision                     | Value                                              |
|------------------------------|----------------------------------------------------|
| Backend                      | Firebase on GCP                                    |
| Sign-in methods              | Email + password only                              |
| Email verification           | **Required** before any AI feature is usable       |
| Trial                        | **None** — Freemium tier is permanent (no lock-in) |
| Existing localStorage users  | Start clean — no migration                         |
| Image + product retention    | Per tier — Freemium 24h / Basic 7d / Advanced 15d / Designer 30d |
| Retention enforcement        | Scheduled Cloud Function (hourly), GCS 30-day lifecycle as safety net |
| Tier change behavior         | On upgrade/downgrade, recompute `expiresAt` for all user's gallery items |
| Payments                     | Stripe (test mode now, live when account approved) |
| Local dev                    | Firebase Emulator Suite + Stripe CLI               |
| Production hosting           | Firebase Hosting on GCP                            |

---

## 2. Membership Tiers

### 2.1 Pricing & Quotas

| Tier        | Price/mo  | Monthly designs | Daily limit | Retention | Watermark | Target audience              |
|-------------|----------:|----------------:|-------------|----------:|-----------|------------------------------|
| Freemium    | $0        | 10              | 2 / day     | 24h       | Yes       | Casual users                 |
| Basic       | $9.99     | 100             | 5 / day     | 7d        | No        | Homeowners & DIY enthusiasts |
| Advanced    | $19.99    | 300             | Unlimited   | 15d       | No        | Power users                  |
| Designer    | $49.99    | Unlimited       | Unlimited   | 30d       | No        | Interior designers, creators |

### 2.2 Feature Matrix

| Feature                             | Freemium | Basic | Advanced | Designer |
|-------------------------------------|----------|-------|----------|----------|
| Monthly designs                     | 10       | 100   | 300      | ∞        |
| Daily generation limit              | 2        | 5     | ∞        | ∞        |
| Gallery retention                   | 24h      | 7d    | 15d      | 30d      |
| Product recommendations retention   | 24h      | 7d    | 15d      | 30d      |
| All AI design themes                | ✓        | ✓     | ✓        | ✓        |
| Watermark on exports                | Yes      | No    | No       | No       |

Room types, furniture matching, and source channels (Amazon/Wayfair/IKEA) remain whatever the current app does for everyone — out of scope for this onboarding-focused rebuild.

### 2.3 Retention Rules

- Retention applies to **both** the gallery image and its associated product recommendations. Products are denormalized into the gallery doc, so they share its `expiresAt`.
- Each gallery item: `expiresAt = createdAt + retentionDays[user.tier]`, computed at write time.
- **On tier change** (Stripe webhook or admin override), `expiresAt` is **recomputed** for all existing items.
- **Downgrade grace floor**: when a downgrade would set `expiresAt` to less than `now + 24h`, clamp to `now + 24h` so users have time to download.
- The GCS bucket has a 30-day lifecycle rule as a **safety net**; actual deletion is driven by the scheduled `expireOldImages` Function, which honors per-tier windows.

### 2.4 Quota Rules

- **Monthly quota** resets at the start of each calendar month (UTC). Tracked as `monthlyDesignCount` + `monthlyResetAt` on the user doc. Reset happens lazily inside `proxyRemodel` (no scheduled job needed).
- **Daily limit** uses a rolling 24h window via `renderTimestamps[]` (already in current code; pruned server-side on each render).
- Both are checked server-side in `proxyRemodel`. Client UI is informational only.

---

## 3. UX/UI Changes

### 3.1 New Screens / Modals

| Screen                          | Trigger                                  | Notes                                          |
|---------------------------------|------------------------------------------|------------------------------------------------|
| Sign-up form                    | "Create account" CTA                     | Email + password + confirm password            |
| Email-verification-pending      | After signup, before access              | "We sent a link to {email}". Resend button.    |
| Forgot password                 | "Forgot password?" link on sign-in       | Firebase sends reset email                     |
| Pricing page                    | Nav "Upgrade", quota wall                | 4 tier cards, current tier highlighted         |
| Upgrade modal                   | Quota reached / gated feature click      | Compact tier comparison, single CTA            |
| Account & billing               | Profile dropdown → "Manage Account"      | Tier, monthly usage, "Manage in Stripe Portal" |
| Watermark notice (Freemium)     | Hover/info icon on Download button       | "Upgrade to remove watermark"                  |
| Stripe Checkout                 | Tier select                              | Hosted by Stripe, redirect; no UI work         |
| Stripe Customer Portal          | "Manage Billing"                         | Hosted by Stripe, redirect; no UI work         |

### 3.2 Modified Existing Screens

| File                              | Change                                                                                      |
|-----------------------------------|---------------------------------------------------------------------------------------------|
| `components/Auth.tsx`             | Add password field, sign-in vs sign-up toggle, forgot-password link, verification flow      |
| `App.tsx` (profile dropdown)      | Show tier badge, monthly usage (X / Y), "Manage Billing", "Upgrade" link                    |
| `components/Navigation.tsx`       | Sidebar footer: dynamic tier label (currently hardcoded "Signature Member / PRO Verified")  |
| `components/Remodeler.tsx`        | Quota banner reads tier from Firestore; show monthly + daily usage; upgrade CTA on wall    |
| `components/Gallery.tsx`          | Per-tier `ExpiryChip` (h/d to expiry); tier-aware retention banner; upgrade CTA on Freemium |
| `components/ShopLookModal.tsx`    | No tier changes — behavior unchanged                                                        |
| `components/AdminDashboard.tsx`   | Pull real numbers from Firestore (replace mock data)                                        |

### 3.3 New Shared Components

- `TierBadge` — chip with tier name + color (Freemium gray, Basic blue, Advanced gold, Designer black)
- `UpgradeCTA` — context-aware ("Upgrade to Basic to remove the watermark and unlock advanced rooms")
- `ExpiryChip` — small "Expires in 3 days / 4 hours" badge for gallery cards (red when ≤24h)
- `QuotaIndicator` — dual progress bar showing monthly + daily usage
- `WatermarkOverlay` — visual marker on Freemium-rendered images in the UI
- `EmailVerifiedGuard` — wraps any route that requires verified email

### 3.4 Empty / Loading States

| Context                       | State to add                                          |
|-------------------------------|-------------------------------------------------------|
| Gallery while Firestore loads | Skeleton cards                                        |
| Auth bootstrap                | Centered spinner (no flash of unauthenticated UI)     |
| Unverified email              | Lock all AI features, route to verification screen    |
| Monthly quota near limit      | Yellow banner: "X of Y designs used this month"       |
| Monthly quota reached         | Red banner + Upgrade CTA                              |
| Daily quota reached (Freemium/Basic) | "Come back tomorrow or upgrade for unlimited" |
| Image about to expire (≤24h)  | Red expiry chip + "Download before it's gone"         |

---

## 4. Data Model

### 4.1 Firestore

```
users/{uid}
  email, name, photoURL
  role:                'Client' | 'Designer' | 'Admin'   (Admin override)
  tier:                'freemium' | 'basic' | 'advanced' | 'designer'
  stripeCustomerId:    string | null
  subscriptionId:      string | null
  subscriptionStatus:  'active' | 'past_due' | 'canceled' | null
  currentPeriodEnd:    timestamp | null
  emailVerified:       boolean              (mirrored from Auth for queries)
  renderTimestamps:    number[]             (last 24h, server-trimmed)
  totalRenders:        number
  monthlyDesignCount:  number               (resets lazily on first render of new month)
  monthlyResetAt:      timestamp            (start of next UTC month)
  createdAt, lastActive

users/{uid}/gallery/{imageId}
  storagePath:        'gallery/{uid}/{imageId}.png'
  thumbnailPath:      'gallery/{uid}/{imageId}_thumb.jpg'
  prompt, projectName, mode, timestamp
  createdAt:          timestamp
  tierAtCreation:     string                (audit only)
  expiresAt:          timestamp             (createdAt + retentionDays[user.tier])
  watermarked:        boolean               (true if rendered while tier='freemium')
  savedProducts:      ProductItem[]        (denormalized; share gallery lifecycle)

stripeEvents/{eventId}                       (webhook idempotency log)
  type, processedAt
```

### 4.2 Firebase Storage

```
gallery/{uid}/{imageId}.png          full resolution (watermarked if Freemium)
gallery/{uid}/{imageId}_thumb.jpg    generated by onFinalize Function
```

### 4.3 Security Rules

- **Firestore:** users can read/write their own `users/{uid}/**`. `tier`, `subscriptionStatus`, `stripeCustomerId`, `monthlyDesignCount`, `monthlyResetAt` are **server-only** (Cloud Functions). Admins can read all.
- **Storage:** read/write only when `request.auth.uid == uid`. Slot-count enforcement happens in the upload Function, not in rules.

---

## 5. Server-Side (Cloud Functions, 2nd gen)

| Function                       | Type            | Purpose                                                                 |
|--------------------------------|-----------------|-------------------------------------------------------------------------|
| `onUserCreate`                 | Auth trigger    | Create `users/{uid}` doc, set `tier='freemium'`, init quota counters    |
| `proxyRemodel`                 | Callable        | Server-side Gemini call; enforces monthly + daily quotas by tier; watermarks Freemium; uploads result to Storage |
| `proxyGenerateImage`           | Callable        | Server-side Gemini image-from-prompt; same quota + watermark logic      |
| `proxyGenerateProductList`     | Callable        | Server-side Gemini call for sourcing; no tier-based filtering (current behavior preserved) |
| `proxyShopifySearch`           | Callable        | Hides `ACCESS_TOKEN`, removes CORS hack                                 |
| `stripeCheckoutSession`        | Callable        | Creates Stripe Checkout for tier upgrade                                |
| `stripePortalSession`          | Callable        | Creates Stripe Customer Portal session                                  |
| `stripeWebhook`                | HTTPS           | Receives subscription events, updates `users/{uid}.tier`, calls `recomputeExpiry` |
| `recomputeExpiry`              | Internal helper | On tier change, iterates user's gallery and sets `expiresAt = createdAt + retentionDays[newTier]`. Downgrade clamped to `now + 24h` minimum. |
| `onGalleryImageFinalize`       | Storage trigger | Generates thumbnail; enforces monthly slot count for tier               |
| `expireOldImages`              | Scheduled (1/h) | Deletes Storage objects + Firestore docs where `expiresAt < now`        |
| `recomputeAnalytics`           | Scheduled (1/d) | Populates admin dashboard aggregates                                    |

All secrets (Gemini key, Shopify token, Stripe secret) live in **Google Secret Manager**, mounted into Functions. Nothing secret in the client bundle.

---

## 6. Task List

Status legend: ☐ todo · ▣ in progress · ✅ done

### Phase 0 — Project Setup (~1 day) — INFRA COMPLETE, PENDING APPLY

- ✅ Decide GCP project + billing structure
- ✅ Create GCP project `prhomz-dev-code-test` in console, link billing
- ✅ Create TF state bucket `prhomz-designer-dev-tfstate`
- ✅ Write `infra/` Terraform (APIs, Firebase, Firestore, Storage, Auth, Secrets, IAM)
- ☐ Run `terraform init && terraform apply` on Mac
- ☐ Accept Firebase ToS in console
- ☐ Add real secret values via `gcloud secrets versions add`
- ☐ Install Firebase CLI locally + run `firebase init` (emulators only)
- ☐ Install Stripe CLI for local webhook forwarding
- ☐ Add `firebase`, `firebase-admin` to npm deps
- ☐ Add Firebase config + emulator detection to Vite config
- ☐ Update root `.gitignore` for service account JSON, Firebase cache

### Phase 1 — Auth & User Model (~3 days)

- ☐ Implement Firebase Auth client wrapper (`services/authService.ts`)
- ☐ Rewrite `components/Auth.tsx`:
  - ☐ Sign-up form (email + password + confirm)
  - ☐ Sign-in form (email + password)
  - ☐ Forgot-password flow
  - ☐ Toggle between sign-in / sign-up
  - ☐ Inline validation + error messaging
- ☐ Build `EmailVerificationPending` screen with resend (rate-limited)
- ☐ Add `EmailVerifiedGuard` for protected routes
- ☐ Implement `onUserCreate` Cloud Function:
  - ☐ Create Firestore user doc
  - ☐ Set `tier: 'freemium'`, `monthlyDesignCount: 0`, `monthlyResetAt: startOfNextMonth(now)`
  - ☐ Mirror `emailVerified` from Auth
- ☐ Replace `App.tsx` localStorage user state with `onAuthStateChanged` + Firestore listener
- ☐ Add auth bootstrap loading state
- ☐ Implement logout (Firebase signOut + clear local state)
- ☐ Firestore security rules for `users/{uid}` (own-doc only; server-only fields locked)
- ☐ Tests: signup → verification → first login on emulator

### Phase 2 — Gallery → Firestore + Storage (~3 days)

- ☐ Build `services/galleryService.ts` (Firestore CRUD + Storage uploads)
- ☐ Rewrite `App.tsx` gallery state to read from Firestore listener (drop localStorage)
- ☐ Update `components/Gallery.tsx`:
  - ☐ Load images from Storage URLs (not base64)
  - ☐ Add `ExpiryChip` (days/hours; red ≤24h)
  - ☐ Tier-aware retention banner: "Images auto-delete after {N} days/hours on your {Tier} plan"
  - ☐ Empty-state CTA for Freemium: "Upgrade to keep your work longer"
  - ☐ Visible watermark indicator on Freemium images
  - ☐ Skeleton loading state
- ☐ Define `RETENTION_BY_TIER = { freemium: 1, basic: 7, advanced: 15, designer: 30 }` (shared constant)
- ☐ Set `expiresAt = createdAt + RETENTION_BY_TIER[user.tier]` at every gallery write
- ☐ Implement `onGalleryImageFinalize` Function (thumbnail generation)
- ☐ Implement `expireOldImages` scheduled Function (hourly, tier-aware via `expiresAt`)
- ☐ Storage security rules (own-folder only)
- ☐ Tests: upload → list → expiry deletion on emulator

### Phase 3 — Cloud Functions Proxy Layer (~3 days)

- ☐ Set up Functions project structure (TypeScript)
- ☐ Move `GEMINI_API_KEY` to Secret Manager
- ☐ Move Shopify `ACCESS_TOKEN` to Secret Manager
- ☐ Define `QUOTA_BY_TIER = { freemium: {monthly:10, daily:2}, basic: {monthly:100, daily:5}, advanced: {monthly:300, daily:Infinity}, designer: {monthly:Infinity, daily:Infinity} }` (shared constant)
- ☐ Implement `proxyRemodel`:
  - ☐ Auth + emailVerified check
  - ☐ Lazy monthly counter reset (if `now > monthlyResetAt`, reset count + set new month)
  - ☐ Enforce monthly quota by tier
  - ☐ Enforce daily quota via `renderTimestamps[]` filter for last 24h
  - ☐ Call Gemini server-side
  - ☐ **Watermark** Freemium output (overlay PNG via Sharp/canvas)
  - ☐ Upload result to Storage
  - ☐ Write Firestore gallery doc with `expiresAt`, `tierAtCreation`, `watermarked` flag
  - ☐ Increment `monthlyDesignCount`, `totalRenders`, push to `renderTimestamps[]` (trim >24h)
- ☐ Implement `proxyGenerateImage` (same pattern)
- ☐ Implement `proxyGenerateProductList` (preserve current behavior — no tier filtering)
- ☐ Implement `proxyShopifySearch` (removes CORS hack)
- ☐ Bundle watermark.png asset with Functions deploy (no extra bucket needed)
- ☐ Refactor `services/geminiService.ts` to call Functions instead of Gemini directly
- ☐ Refactor `services/dataService.ts` to call Functions instead of Shopify directly
- ☐ Verify client bundle no longer contains either secret (grep production build)
- ☐ Tests: end-to-end render flow on emulator; watermark visible on Freemium, absent on paid

### Phase 4 — Stripe Integration (test mode) (~4 days)

- ☐ Create Stripe products + prices for Basic ($9.99), Advanced ($19.99), Designer ($49.99) (test mode)
- ☐ Store Stripe price IDs in Functions config
- ☐ Build `components/PricingPage.tsx` with 4 tier cards (Freemium current/free, 3 paid)
- ☐ Build `components/UpgradeModal.tsx` (compact pricing)
- ☐ Build `components/AccountPage.tsx` (tier, monthly usage, billing link)
- ☐ Build `TierBadge`, `UpgradeCTA`, `QuotaIndicator` components
- ☐ Implement `stripeCheckoutSession` Function
- ☐ Implement `stripePortalSession` Function
- ☐ Implement `stripeWebhook` Function:
  - ☐ Idempotency via `stripeEvents/{eventId}` log
  - ☐ Handle `customer.subscription.created` → set tier, call `recomputeExpiry`
  - ☐ Handle `customer.subscription.updated` → update tier, call `recomputeExpiry`
  - ☐ Handle `customer.subscription.deleted` → downgrade to Freemium, call `recomputeExpiry`
  - ☐ Handle `invoice.payment_failed` → `past_due`
- ☐ Implement `recomputeExpiry` helper (downgrade grace floor: `now + 24h` minimum)
- ☐ Wire profile dropdown → `AccountPage`
- ☐ Wire Navigation footer to show real tier badge
- ☐ Configure Stripe CLI to forward webhooks to emulator
- ☐ Tests: upgrade Freemium → Basic; downgrade; cancel; payment failure paths

### Phase 5 — Tier Enforcement & UX Wiring (~2 days)

- ☐ Rewrite `Remodeler.tsx` quota banner:
  - ☐ Show current tier, monthly usage (X / Y), daily usage (X / Y or "∞")
  - ☐ Show upgrade CTA on quota wall
  - ☐ Disable submit when at quota
- ☐ Add watermark notice tooltip on Freemium download button
- ☐ Upgrade-CTA placement audit: Pricing page, profile dropdown, quota wall, gallery empty state on Freemium
- ☐ Email-on-quota-near-limit (90% monthly) — optional, Firebase Extension

### Phase 6 — Admin Dashboard ↔ Real Data (~1.5 days)

- ☐ Implement `recomputeAnalytics` scheduled Function (daily)
- ☐ Aggregate: total designs, total products sourced, revenue potential, active users
- ☐ Aggregate: usage by tier (Freemium/Basic/Advanced/Designer counts)
- ☐ Rewrite `AdminDashboard.tsx` to read from `analytics` collection
- ☐ Admin-only Firestore rules
- ☐ Admin user-management actions (suspend, override tier — admin grants Designer-role benefits without subscription)

### Phase 7 — Production Cutover to GCP (~1.5 days)

- ☐ Configure Firebase Hosting (`firebase.json`, redirects, headers)
- ☐ Enable Firebase App Check (reCAPTCHA v3) on callable Functions
- ☐ Set budget alerts on GCP project
- ☐ Configure custom domain + SSL on Firebase Hosting
- ☐ Switch Stripe to live keys (when account approved)
- ☐ Switch Stripe webhook endpoint to production URL
- ☐ Smoke test: signup → verify → render (with watermark) → upgrade → render (no watermark) → expire
- ☐ Cloud Logging alerts for Function errors
- ☐ Runbook (rotating keys, draining quota, refunding, watermark asset rotation)

### Phase 8 — Cleanup & Polish (~1 day)

- ☐ Remove dead `productService.ts` (currently 30 bytes)
- ☐ Remove `migrated_prompt_history/` if unused
- ☐ Delete `FALLBACK_INVENTORY` from client (lives server-side if still needed)
- ☐ Update `DOCUMENTATION.md` and `HANDOVER_DOCUMENTATION.md`
- ☐ Add E2E test (Playwright or similar) for the critical path
- ☐ Polish watermark asset (final brand-approved PNG)

---

## 7. Total Estimate

| Phase                        | Days  |
|------------------------------|------:|
| 0 — Setup (mostly done)      | 1     |
| 1 — Auth & user model        | 3     |
| 2 — Gallery → Firestore      | 3     |
| 3 — Functions proxy + watermark | 3  |
| 4 — Stripe integration       | 4     |
| 5 — Tier enforcement & UX    | 2     |
| 6 — Admin dashboard          | 1.5   |
| 7 — Production cutover       | 1.5   |
| 8 — Cleanup                  | 1     |
| **Total**                    | **20 days (~4 weeks solo, ~2 weeks paired)** |

---

## 8. Open Questions (Non-Blocking)

- Stripe live-mode timing — affects Phase 7 only; can stay in test mode until ready.
- Watermark design — needs final brand-approved PNG before Phase 3 ships to users. Placeholder is fine for dev.
- Designer role override — `role='Designer'` (admin-granted) grants Designer-tier benefits without a subscription. Implementation: `effectiveTier = role === 'Designer' ? 'designer' : user.tier`.
- Room types, furniture matching, and source-channel selection are **deferred** — current app behavior is preserved across all tiers for this onboarding-focused rebuild.
- Refund policy — out of scope; defer until first paid user.
- Welcome email branding — Firebase default templates initially; swap to custom (SendGrid / Firebase Extension) later.

---

## 9. Risks & Mitigations

| Risk                                                | Mitigation                                                |
|-----------------------------------------------------|-----------------------------------------------------------|
| Gemini API cost runaway                             | Server-side monthly + daily quota + GCP budget alerts     |
| Stripe webhook race / double-charge                 | Idempotency log in `stripeEvents/{eventId}`               |
| Storage cost from large gallery                     | Per-tier retention (1/7/15/30d), 30-day GCS safety net    |
| Users skip email verification, fill quota with junk | `EmailVerifiedGuard` blocks all paid Function calls       |
| Free tier abuse via multiple accounts               | Email verification required; future: device fingerprinting / IP rate limit |
| Secrets leaking via client bundle                   | Secret Manager + grep production build before each deploy |
| Watermark removed by users via crop/photoshop       | Acceptable; watermark is friction, not DRM. Real protection is the rate limit and the value users get from paying. |
| Monthly counter reset bug (lost renders)            | Lazy reset is idempotent; defensive: don't decrement, only set to 0 on stale `monthlyResetAt` |
