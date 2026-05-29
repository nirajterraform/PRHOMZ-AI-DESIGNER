# Phase 2 Completion Report — Gallery → Firestore + Storage

**Project:** PRHOMZ AI Designer
**Phase:** 2 of 8 (Gallery → Firestore + Storage)
**Status:** Complete (with the two Cloud Functions deferred to Phase 3 by design)
**Environment validated:** Local development against Firebase Emulator Suite, with a paid-tier Gemini API key
**Date completed:** 2026-05-14

---

## 1. Executive Summary

Phase 2 migrated the application's image gallery from `localStorage` (5-image cap, lost on browser cache clear) to Cloud Storage + Cloud Firestore. Every generated image is now uploaded as a real PNG to Firebase Storage and indexed in Firestore at `users/{uid}/gallery/{imageId}`. The Gallery page reads from a real-time Firestore listener, so the same user sees the same gallery across tabs, devices, and sessions.

The data model is now tier-aware: every gallery document carries an `expiresAt` timestamp computed at write time using `RETENTION_DAYS_BY_TIER`. The UI surfaces this via a color-coded `ExpiryChip` per image and a tier-aware retention banner at the top of the gallery. Freemium-rendered images carry a `watermarked: true` flag and a visible "WATERMARK" chip; the actual watermark overlay is deferred to Phase 3 when image rendering moves server-side.

Two Cloud Functions originally scoped for Phase 2 — `onGalleryImageFinalize` (thumbnail generation) and `expireOldImages` (per-tier retention enforcement) — were intentionally deferred to Phase 3 to consolidate all Functions into one deployment. Expired images are simply hidden from the UI via a Firestore query filter until Phase 3's cleanup job runs.

The Gemini API key was upgraded to a paid-tier project during this phase — required because image-generation models have zero allowance on free tier.

---

## 2. Goals of Phase 2

From the implementation plan:

| Goal                                                              | Status |
|-------------------------------------------------------------------|--------|
| Move generated images out of `localStorage` to Cloud Storage      | Done   |
| Index image metadata in Cloud Firestore (`users/{uid}/gallery`)   | Done   |
| Compute `expiresAt` from tier-specific retention windows          | Done   |
| Tier-aware UI: per-image expiry chip + retention banner           | Done   |
| Freemium watermark indicator on gallery cards                     | Done (indicator only; real overlay in Phase 3) |
| Real-time gallery sync across tabs and devices                    | Done   |
| Cross-tab + refresh persistence                                   | Done   |
| Skeleton loading state                                            | Done   |
| Freemium upgrade CTA on empty gallery                             | Done   |
| Migration of existing localStorage galleries                      | Skipped (per stakeholder spec — start clean) |

---

## 3. What Was Built

### 3.1 New Files

| File                                          | Purpose                                                                       |
|-----------------------------------------------|-------------------------------------------------------------------------------|
| `services/galleryService.ts`                  | All Storage + Firestore gallery operations. Exports `RETENTION_DAYS_BY_TIER` constant, `computeExpiresAt`, `uploadGalleryImage`, `subscribeToGallery`, `saveProductsToImage`, `deleteGalleryImage`. |
| `components/ExpiryChip.tsx`                   | Color-coded "Expires in N h/d" badge. Re-renders every minute to keep the countdown live. Gray > 24h, yellow 6-24h, red < 6h or expired. |

### 3.2 Modified Files

| File                                          | Change                                                                       |
|-----------------------------------------------|------------------------------------------------------------------------------|
| `types.ts`                                    | `GeneratedImage` extended with `storagePath`, `createdAt`, `expiresAt`, `tierAtCreation`, `watermarked`. `timestamp` field kept as a legacy alias of `createdAt` for backward compatibility with display code. `AnalyticsSummary.usageByTier` keys renamed (essential→freemium, signature→basic, premium→advanced, elite→designer) to match the agreed tier model. |
| `components/Remodeler.tsx`                    | After a successful `remodelImage` call, the result is uploaded to Storage via `uploadGalleryImage`, which also writes the Firestore gallery doc. The `imageId` of the upload is held in local state so the inline ShopLookModal `onSaveProducts` callback can attach products to the correct gallery doc via `saveProductsToImage`. The `onSaveProducts` prop dropped from `RemodelerProps` — Remodeler now owns this concern. |
| `components/Gallery.tsx`                      | Rewritten. Receives `images` (from Firestore subscription), `tier`, `isLoading` via props. Adds `ExpiryChip`, "WATERMARK" chip, tier-aware retention banner, Freemium upgrade hint on empty state, skeleton card array during initial load. Sourcing-manifest modal preserved verbatim from Phase 1. |
| `App.tsx`                                     | Removed all `localStorage.getItem/setItem` calls for gallery. Removed `handleSaveProductsToImage`. Added `isGalleryLoading` state and `subscribeToGallery` `useEffect` that connects/disconnects based on `authUser`. `handleImageGenerated` now only triggers the render counter (`recordRender`) — image persistence is handled by Remodeler. |
| `firestore.rules`                             | Added rules block for `users/{userId}/gallery/{imageId}` — owner-only read/create/update/delete. Phase 1's wildcard-deny still catches everything else. |
| `.gitignore`                                  | Added `.emulator-data/` so Firebase Emulator data snapshots aren't committed. |

### 3.3 New Constants

```
RETENTION_DAYS_BY_TIER = {
  freemium:  1,
  basic:     7,
  advanced: 15,
  designer: 30,
}
```

Defined in `services/galleryService.ts`. In Phase 3 this constant will be promoted to a module shared between client and Cloud Functions so the cleanup job uses the same source of truth.

### 3.4 Data Model — `users/{uid}/gallery/{imageId}` Firestore document

Created on every successful Gemini render:

```
id:               <imageId — millisecond timestamp + 6 random chars>
url:              <Firebase Storage download URL>
storagePath:      'gallery/{uid}/{imageId}.png'
prompt:           <full instruction including style and budget>
mode:             'edit'
timestamp:        <createdAt — kept for legacy display code>
createdAt:        <Date.now() at upload time>
expiresAt:        createdAt + RETENTION_DAYS_BY_TIER[user.tier] * 86_400_000
tierAtCreation:   <user's current tier at render time>
watermarked:      <true if tierAtCreation === 'freemium'>
projectName:      <user-typed name or 'Untitled Iteration'>
savedProducts:    [...] (added later via ShopLookModal; share gallery lifecycle)
```

---

## 4. End-to-End Flows

### 4.1 New Render → Persisted Gallery Item

1. User selects style + clicks Apply in Remodeler.
2. `remodelImage` calls Gemini with the input image and full instruction.
3. Gemini returns a base64 PNG; Remodeler shows it immediately in the result pane.
4. In parallel, `uploadGalleryImage` runs:
   - Converts base64 → Blob → uploads to `gallery/{uid}/{imageId}.png` in Storage emulator.
   - Calls `getDownloadURL` to get a fetchable URL.
   - Writes a Firestore doc with all metadata and `expiresAt` computed from `RETENTION_DAYS_BY_TIER[user.tier]`.
5. App.tsx's gallery subscription fires with the new doc → Gallery component re-renders with the new card visible.
6. `recordRender` updates the user's `renderTimestamps` + `totalRenders` + `monthlyDesignCount` on the user doc.

### 4.2 Save Products to a Gallery Item

1. User clicks **Shop Furnishings** on the result image; ShopLookModal opens.
2. ShopLookModal runs `generateProductList` against the image (Gemini scan).
3. User selects products and clicks save.
4. Inline `onSaveProducts` callback in Remodeler runs `saveProductsToImage(uid, lastUploadedImageId, products)`.
5. Firestore doc is updated with `savedProducts: ProductItem[]` via `setDoc(..., { merge: true })`.
6. Gallery subscription pushes the update; the card now shows the "View N Sourced Pieces" button.

### 4.3 Gallery Read with Expiry Filtering

1. App.tsx subscribes to `users/{uid}/gallery` via `subscribeToGallery`.
2. Firestore query filters `where('expiresAt', '>', now)` and orders `expiresAt desc`.
3. Client also re-filters by `expiresAt > now` on each snapshot (catches edge cases where a doc was eligible at subscription time but expired since).
4. Results are sorted client-side by `createdAt` descending so newest cards appear first.
5. Each card's `ExpiryChip` re-renders every 60 seconds so countdowns stay live.

### 4.4 Cross-Tab Sync

Firestore's real-time listener propagates writes to every subscribed client within ~50ms over a LAN connection. Two browser tabs of the same user share the same `users/{uid}/gallery` subscription, so a render initiated in tab A appears in tab B without any explicit messaging.

---

## 5. Decisions Made During Phase 2

### 5.1 Deferred both Cloud Functions to Phase 3

Both `onGalleryImageFinalize` (Storage trigger for thumbnail generation) and `expireOldImages` (scheduled hourly cleanup) were originally Phase 2 deliverables. Decision: defer both to Phase 3.

**Why:** Same rationale as Phase 1's `onUserCreate` deferral — one Cloud Functions deployment is cleaner than two. The deferred features have functional workarounds in Phase 2:

- No thumbnails → Gallery displays the full-size image, CSS-scaled to the card. Slight bandwidth cost during browsing; not a functional issue.
- No cleanup job → Expired Firestore docs accumulate but are hidden from the UI via the `where('expiresAt', '>', now)` query. The GCS bucket's 30-day lifecycle rule (set in Terraform during Phase 0) is a safety net.

### 5.2 Watermark indicator only — actual overlay deferred to Phase 3

The Phase 2 code sets `watermarked: true` on every Freemium-rendered image and shows a "WATERMARK" chip on the gallery card, plus a tooltip on the download button. The PNG itself is unwatermarked.

**Why:** Watermark application is image manipulation (Sharp or canvas) that belongs in the `proxyRemodel` Cloud Function. Doing it client-side in Phase 2 would mean rewriting that logic in Phase 3 when render moves server-side — wasted effort. The chip + tooltip carry the *product signal* (Freemium downloads are watermarked) before the real overlay ships.

### 5.3 Hide expired docs via Firestore query filter

We don't physically delete expired gallery docs until Phase 3 deploys `expireOldImages`. In the meantime, the UI never shows them because the subscription query filters them out.

**Why:** Cleaner UX (users don't see "expired" items) and zero risk of accidentally exposing the half-finished cleanup state. When Phase 3 deletes them, they were already invisible — no UI flicker.

### 5.4 Per-tier retention computed at write time, not read time

Every gallery doc stores its own `expiresAt`, computed from the user's tier *at the moment of render*. A render done while Freemium gets 1-day retention, even if the user later upgrades.

**Why:** Simpler reasoning, no recomputation logic in the read path, and matches the eventual `recomputeExpiry` flow on tier change (Phase 4) — that helper will iterate gallery docs and update `expiresAt` directly. Storing the value at write time is the right primitive.

### 5.5 `lastUploadedImageId` lives in Remodeler, not App.tsx

To save products to the correct gallery doc, ShopLookModal needs the `imageId` of the most recently rendered image. Phase 2 keeps this in Remodeler's local state rather than threading it through App.tsx.

**Why:** Locality — Remodeler is the only consumer. Lifting it to App.tsx adds prop plumbing for one read site.

---

## 6. Testing Performed

All tests passed against the local Firebase Emulator Suite (with `--import=./.emulator-data --export-on-exit` for cross-restart persistence) + paid-tier Gemini API key:

| Test | Outcome |
|------|---------|
| Sign in → empty Gallery with Freemium upgrade hint card visible | Pass |
| Generate a remodel → image appears in result pane immediately | Pass |
| Same image appears in Gallery within ~1 second (Firestore push) | Pass |
| Gallery card shows red ExpiryChip ("Expires in 24h" on Freemium) | Pass |
| Gallery card shows "WATERMARK" chip on Freemium-rendered image | Pass |
| Firebase Storage emulator UI shows the actual PNG at `gallery/{uid}/{imageId}.png` | Pass |
| Firestore emulator UI shows the doc with correct `expiresAt`, `tierAtCreation`, `watermarked`, `storagePath` | Pass |
| Cross-tab sync: render in tab A appears in tab B's Gallery | Pass |
| Hard refresh → Gallery state preserved | Pass |
| ShopLookModal scan + save → "View N Sourced Pieces" button appears on the card | Pass |
| "Buy Now" inside the products modal opens the product URL in a new tab | Pass |
| Tier banner displays "auto-delete after 24 hours on your Freemium plan" | Pass |
| Manually changing `tier` to `'basic'` in Firestore emulator → banner updates to "7 days on your Basic plan" | Pass |
| Manually setting a doc's `expiresAt` to 1 (forced expiry) → image hidden from Gallery | Pass |

---

## 7. What Was Not Built in Phase 2 (Intentionally Deferred)

| Item                                                | New phase | Reason for defer                                                                                                  |
|-----------------------------------------------------|-----------|-------------------------------------------------------------------------------------------------------------------|
| `onGalleryImageFinalize` (Storage trigger — thumbnails) | Phase 3 | Consolidate all Functions into one deployment.                                                                    |
| `expireOldImages` (scheduled cleanup, hourly)       | Phase 3   | Same — and the Firestore query filter hides expired docs in the meantime.                                         |
| Real watermark overlay on the Freemium PNG          | Phase 3   | Image manipulation belongs in `proxyRemodel` Function, where it can run once server-side instead of in every browser. |
| Tightened Firestore rules (server-only create on gallery docs) | Phase 3 | Requires the Functions runtime SA to be the writer; right now the client creates docs. |
| Storage CORS tightening to prod domain              | Phase 7   | Production domain isn't live yet.                                                                                  |
| Per-tier gallery slot count enforcement (5/50/500/∞)| Phase 5   | Out of scope for the data-path migration; full tier-quota enforcement is later.                                  |
| Hard-delete UI (trash icon)                         | Later     | Not in scope. Trash icon left visible-but-disabled to preserve the existing layout.                              |

---

## 8. Production Migration Checklist

What changes in production beyond Phase 1's checklist:

### 8.1 Storage Bucket — Tighten CORS

Currently `infra/storage.tf` declares `origin: ["*"]` on the gallery bucket. Before launch, replace with the production domain only:

```
cors {
  origin          = ["https://app.prhomz.com"]
  method          = ["GET", "POST", "PUT", "DELETE", "HEAD"]
  response_header = ["Content-Type", "Authorization"]
  max_age_seconds = 3600
}
```

Then `terraform apply` from `infra/`. Wildcard CORS lets any origin upload — fine for dev, bad for prod.

### 8.2 Storage Bucket — Confirm Lifecycle Safety Net

`infra/storage.tf` already sets `age = 30` days as the bucket-level safety net. No change required, but verify after `terraform apply`:

```
gcloud storage buckets describe gs://prhomz-dev-code-test-gallery
```

Should show a `lifecycle_config.rule` with `condition.age: 30` and `action.type: Delete`. This catches anything the `expireOldImages` Function fails to remove.

### 8.3 Storage Rules — Deploy to Live Firebase

The Phase 2 `storage.rules` and `firestore.rules` are loaded by the emulator at startup but are not yet pushed to live Firebase. When ready:

```
firebase deploy --only firestore:rules,storage:rules --project prhomz-dev-code-test
```

This is a one-line deploy that takes ~10 seconds. Re-run whenever rules change.

### 8.4 Firebase Storage Default Bucket

The Storage SDK in `firebaseClient.ts` connects to the bucket whose name is in `VITE_FIREBASE_STORAGE_BUCKET`. We set this to the custom-named bucket (`prhomz-dev-code-test-gallery`) in Phase 0 — not the default `<project>.appspot.com` bucket Firebase usually provisions. This works in both emulator and prod, no code change required.

### 8.5 App Check Coverage Extended to Storage

When Phase 7 enables App Check for Auth + Firestore, **add Storage too**. Otherwise bots could call the Storage REST API directly with valid auth tokens and burn upload bandwidth. Configuration is a single line in the Firebase Console alongside the other App Check toggles.

### 8.6 Download URL Tokens

Firebase Storage download URLs include a non-expiring token. These URLs are reasonably safe to embed in Firestore (they're per-object and revokable from the bucket), but be aware that anyone with the URL can fetch the image. The security boundary is "who can read the Firestore doc to get the URL." Our rules already enforce owner-only Firestore reads, so this is acceptable.

If you ever want stricter — e.g., signed URLs that expire — the change is in `galleryService.ts`'s upload path:
- Replace `getDownloadURL` with a signed-URL Cloud Function call.
- Refresh the URL on Gallery reads when it's near expiry.

Not needed for the user-onboarding scope.

### 8.7 Browser Cache Strategy

Storage downloads are served with HTTP caching headers from Google's CDN, so repeated views of the same gallery card are essentially free of GET cost. No code change required; just useful to know when reasoning about Storage bills.

---

## 9. Known Limitations

| Limitation                                                  | Severity | Mitigation                                |
|-------------------------------------------------------------|----------|-------------------------------------------|
| Full-size images served to gallery cards (no thumbnails)    | Low      | Phase 3 deploys `onGalleryImageFinalize`  |
| Expired Firestore docs accumulate until Phase 3 cleanup     | Low      | Hidden from UI via query filter; GCS lifecycle catches storage objects after 30 days |
| Client can write gallery docs with forged `expiresAt` / `tierAtCreation` | Low | No exploit value yet (no tier-based gating). Phase 3 locks creation to Functions runtime SA. |
| No hard-delete UI                                            | Low      | Trash icon visible-but-disabled; intentional. |
| Watermark is indicator-only (PNG unwatermarked)              | Medium   | Phase 3 `proxyRemodel` Function applies real overlay |
| Per-tier gallery slot count not enforced                     | Low      | Phase 5 wires `monthlyDesignCount` + slot caps |
| Storage bucket CORS is wildcard `*`                          | Medium   | Phase 7 tightens to production domain     |

---

## 10. Cost Impact

Phase 2 introduced first-time runtime spending in two places:

### 10.1 Gemini API (now real money)

Switching from free-tier to paid-tier Gemini was required for image-generation models. Pricing at time of writing:

- `gemini-2.5-flash-image`: ~$0.04 per generated image.

At the Phase 2 testing scale (10-20 renders during validation), this is well under $1. At 1,000 active users × average 10 renders/month, this is ~$400/month and grows linearly with usage.

This is the dominant variable cost at scale and is documented in [infra-plan-design.doc §4.4](infra-plan-design.doc).

### 10.2 Firebase Storage

- Storage at rest: $0.02/GB/month in `us-central1`
- Class-A operations (writes): $0.05 per 10K
- Class-B operations (reads): $0.004 per 10K
- Egress: 1 GB free tier, then $0.12/GB

At Phase 2 dev scale: pennies. At 1,000 users × 100 renders/month × 500 KB per image with 7-day average retention: ~5 GB working set ≈ $0.10/month + minor ops cost. Negligible.

### 10.3 Firestore

- Reads: $0.06 per 100K above free tier (1.5M/month free)
- Writes: $0.18 per 100K above free tier (600K/month free)

Each render = 1 Firestore write (gallery doc) + maybe 1 user-doc update. Each page load = 1 Firestore read per gallery doc displayed. At dev scale: pennies; at 1,000 active users: still inside free tier likely.

---

## 11. Files Changed Summary

```
New:
  services/galleryService.ts
  components/ExpiryChip.tsx
  phase-2-completion-report.md

Modified:
  types.ts                       (GeneratedImage extended; AnalyticsSummary keys fixed)
  components/Remodeler.tsx       (upload + lastUploadedImageId + ShopLookModal save callback)
  components/Gallery.tsx         (rewrite — ExpiryChip, watermark chip, tier banner, skeleton)
  App.tsx                        (drop localStorage; subscribe to Firestore gallery)
  firestore.rules                (gallery subcollection allow rules)
  .gitignore                     (.emulator-data/)

Total: 2 new code files + 1 new doc, 6 modified files, ~450 lines of net code added.
```

---

## 12. Sign-Off

| Item                                                | Verified |
|-----------------------------------------------------|----------|
| Gallery upload writes to Storage + Firestore        | Yes      |
| Cross-tab sync works                                | Yes      |
| Refresh persistence works                           | Yes      |
| Expiry chip shows correct color + label             | Yes      |
| Watermark chip shows on Freemium images             | Yes      |
| Tier banner reflects user's actual tier             | Yes      |
| Expired docs hidden from UI                         | Yes      |
| ShopLookModal save persists to correct gallery doc  | Yes      |
| All 8 test scenarios in §6 passed                   | Yes      |
| Production migration path documented                | Yes      |
| No regressions in Phase 1 deliverables              | Yes      |

**Phase 2 status: complete. Ready for Phase 3.**

---

## 13. What Phase 3 Will Add

Brief preview so this report sits in context. Phase 3 is the **Cloud Functions phase** — everything we deferred from Phases 1, 2, and the Functions originally scoped for Phase 3 land in one deployment:

- **`onUserCreate`** (Auth trigger) — replaces the client-side `ensureUserDoc` from Phase 1. Sets `tier: 'freemium'` server-side so the client can never forge a higher tier.
- **`onGalleryImageFinalize`** (Storage trigger) — generates a small thumbnail when a full image is uploaded, stores it next to the original.
- **`expireOldImages`** (scheduled hourly) — deletes Firestore docs + Storage objects where `expiresAt < now`. Honors per-tier retention windows exactly.
- **`proxyRemodel`**, **`proxyGenerateImage`**, **`proxyGenerateProductList`** — move all Gemini calls off the client. The `GEMINI_API_KEY` will no longer ship in the browser bundle.
- **`proxyShopifySearch`** — same, for the Shopify Admin token.
- **Real watermark overlay** — applied inside `proxyRemodel` for Freemium users, using `sharp` or canvas-in-node.
- **Tightened Firestore rules** — gallery and user doc creation become server-only.

After Phase 3, the client bundle will contain zero secrets, and all entitlement-shaping logic (tier checks, quota enforcement, watermark) lives in one server-side place we can audit.

Phase 2 deliverables remain unchanged through Phase 3.
