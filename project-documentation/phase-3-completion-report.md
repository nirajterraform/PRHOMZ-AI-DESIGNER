# Phase 3 Completion Report — Cloud Functions & Server-Side Lockdown

**Project:** PRHOMZ AI Designer
**Phase:** 3 of 8 (Cloud Functions & Server-Side Lockdown)
**Status:** Complete
**Environment validated:** Local development against Firebase Emulator Suite, with a paid-tier Gemini API key
**Date completed:** 2026-05-15

---

## 1. Executive Summary

Phase 3 moved every Gemini call, every Shopify call, and every privileged Firestore write off the browser and into Cloud Functions. The client bundle no longer contains the Gemini API key, the Shopify Admin access token, or the `@google/genai` SDK. Tier, quota, subscription state, and gallery doc creation are server-only — clients can read their own state but cannot mutate the fields that drive entitlement.

Nine Cloud Functions are now deployed to the Firebase Emulator Suite:

- Three lifecycle Functions — `onUserCreate` (Auth trigger), `onGalleryImageFinalize` (Storage trigger, generates JPG thumbnails), `expireOldImages` (scheduled hourly cleanup honoring per-tier retention)
- Three image Functions — `proxyRemodel`, `proxyGenerateImage`, `proxyGenerateProductList` — that wrap the Gemini calls with auth checks, an atomic quota reservation (Firestore transaction), a real `sharp`-based watermark for Freemium output, and a Firebase-style download-URL emission
- Three text Functions — `proxyShopifySearch`, `proxySwapProduct`, `proxyChat` — that handle Assistant chat plus all catalog lookups

Phase 3 also tightened `firestore.rules` so the client can no longer write `tier`, `monthlyDesignCount`, `renderTimestamps`, `subscriptionStatus`, or `role` on the user doc, and gallery doc creation is server-only. Clients can still update one specific field on a gallery doc — `savedProducts` — to keep the existing "Save Selection" flow working without a round-trip.

The watermark deferred from Phase 2 is now applied as a real SVG composite onto the actual PNG before upload, not just a UI chip. The thumbnail deferred from Phase 2 is now generated server-side by `onGalleryImageFinalize` as a 400×300 JPG, picked up by the gallery via `thumbnailPath` → resolved download URL.

The Shopify Admin token was relocated to Secret Manager (`shopify-access-token`), referenced via `defineSecret` inside `proxyGenerateProductList`, `proxyShopifySearch`, and `proxySwapProduct`. The Gemini key was relocated the same way (`gemini-api-key`). Locally the secrets live in the gitignored `functions/.secret.local`.

---

## 2. Goals of Phase 3

From the implementation plan and the items deferred from Phases 1 and 2:

| Goal                                                                | Status |
|---------------------------------------------------------------------|--------|
| `onUserCreate` Auth trigger — server-owned user doc creation        | Done   |
| `onGalleryImageFinalize` Storage trigger — thumbnail generation     | Done   |
| `expireOldImages` scheduled function — per-tier retention cleanup   | Done   |
| `proxyRemodel` callable — server-side Gemini image edit             | Done   |
| `proxyGenerateImage` callable — server-side Gemini text-to-image    | Done   |
| `proxyGenerateProductList` callable — server-side Gemini scan + Shopify match | Done |
| `proxyShopifySearch` callable — catalog search (added in Day 3)     | Done   |
| `proxySwapProduct` callable — alternative-piece swap (added in Day 3) | Done |
| `proxyChat` callable — Assistant chat (added in Day 3)              | Done   |
| Real watermark overlay on Freemium PNGs (sharp + SVG)               | Done   |
| Atomic quota reservation via Firestore transaction                  | Done   |
| Rollback on Gemini failure                                          | Done   |
| Tighten `firestore.rules` — server-only fields + gallery create     | Done   |
| Remove `GEMINI_API_KEY` from client bundle                          | Done (0 grep hits in dist) |
| Remove Shopify access token from client                             | Done (lived in `services/dataService.ts`, now gone) |
| Move `@google/genai` SDK out of client bundle                       | Done (0 grep hits in dist) |
| Firebase-style download-URL emission server-side                    | Done (`uploadAndGetDownloadURL` lib) |

---

## 3. What Was Built

### 3.1 New Files

**Cloud Functions runtime (`functions/`)**

| File                                          | Purpose                                                                       |
|-----------------------------------------------|-------------------------------------------------------------------------------|
| `functions/package.json`                      | Node 20 runtime. Deps: `firebase-functions ^6.1.0`, `firebase-admin ^12.7.0`, `@google/genai ^1.34.0`, `sharp ^0.34.0`. Prebuild script copies `../shared/*` into `src/_shared/`. |
| `functions/tsconfig.json`                     | CommonJS, ES2022, strict, outDir `lib`.                                       |
| `functions/.secret.local` (gitignored)        | `gemini-api-key=...` and `shopify-access-token=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`. Loaded by `defineSecret` at emulator boot. |
| `functions/.gitignore`                        | Excludes `lib/`, `.secret.local`, `node_modules/`, `src/_shared/`.            |
| `functions/src/index.ts`                      | Single entry point: `admin.initializeApp()` + named exports of all 9 functions. |
| `functions/src/onUserCreate.ts`               | Gen-1 `auth.user().onCreate` trigger. Creates `users/{uid}` Firestore doc with Freemium defaults — race-safe against any prior client-side ensure. |
| `functions/src/onGalleryImageFinalize.ts`     | Gen-2 `onObjectFinalized` on the gallery bucket. Skips non-PNG, skips `_thumb` outputs, generates a 400×300 JPG at quality 80 with `sharp`, writes back to Storage and patches the Firestore doc with `thumbnailPath`. |
| `functions/src/expireOldImages.ts`            | Gen-2 `onSchedule("every 1 hours")`. Collection-group query for `expiresAt < now`; deletes Firestore doc + Storage object + thumbnail. Pub/Sub-backed schedule, runs in the emulator via the pubsub emulator on port 8085. |
| `functions/src/proxyRemodel.ts`               | Callable. Auth + emailVerified gate → `reserveRenderSlot` transaction → Gemini `gemini-2.5-flash-image` call → optional `applyWatermark` → upload + Firestore write → returns `{ imageId, url, storagePath, watermarked, tier, monthlyUsed, monthlyLimit, dailyUsed, dailyLimit }`. Rollback on any failure after the reservation. |
| `functions/src/proxyGenerateImage.ts`         | Same shape as `proxyRemodel` but text-to-image (no input image) and uses `aspectRatio` config. |
| `functions/src/proxyGenerateProductList.ts`   | Callable. Gemini structured-JSON scan against an input image → `findMatchingInventory` against PRHOMZ Shopify or external sources → returns matched product list. Does not consume render quota (text-only generation). |
| `functions/src/proxyShopifySearch.ts`         | Callable. Catalog search by query string → Gemini structured-JSON + `findMatchingInventory` → product list. |
| `functions/src/proxySwapProduct.ts`           | Callable. Input: image + current product name → Gemini alternative suggestion + Shopify match. |
| `functions/src/proxyChat.ts`                  | Callable. Wraps `ai.chats.create({ model: 'gemini-3.1-pro-preview' })` with the PRHOMZ designer system instruction. |
| `functions/src/lib/quota.ts`                  | `reserveRenderSlot(uid)` — Firestore transaction. Loads user doc, applies tier defaults if missing, resets monthly/daily windows when stale, checks against `QUOTA_BY_TIER`, increments counters, returns `{ ok, tier, monthlyUsed, monthlyLimit, dailyUsed, dailyLimit, reason? }`. Atomic — no race between two concurrent renders. |
| `functions/src/lib/watermark.ts`              | `applyWatermark(Buffer)` — composites an SVG text overlay ("PRHOMZ • Freemium", semi-transparent, bottom-right) via `sharp`. Output is a real watermarked PNG, not a UI chip. |
| `functions/src/lib/storage.ts`                | `uploadAndGetDownloadURL(path, buffer, contentType)` — uploads to the gallery bucket, sets a `firebaseStorageDownloadTokens` UUID in metadata, returns a Firebase-style download URL. Works against both emulator (`http://127.0.0.1:9199`) and prod (`https://firebasestorage.googleapis.com`). |
| `functions/src/lib/shopify.ts`                | Server-side port of `services/dataService.ts`'s Shopify logic. `findMatchingInventory(name, source, accessToken)` — live API lookup for PRHOMZ source with fuzzy local fallback, external-search URL for Amazon/Wayfair/IKEA. |
| `functions/src/_shared/tiers.ts` (generated)  | Copied at build time from the root `shared/tiers.ts` via the `prebuild` script. Single source of truth for `RETENTION_DAYS_BY_TIER`, `QUOTA_BY_TIER`, `computeExpiresAt`, `startOfNextMonthUTC`. |

**Frontend**

| File                                          | Purpose                                                                       |
|-----------------------------------------------|-------------------------------------------------------------------------------|
| `shared/tiers.ts`                             | Single source of truth shared between client and Functions for tier metadata. Pre-existed in Phase 2; promoted in Phase 3 to be the canonical copy that Functions builds against. |
| `phase-3-completion-report.md`                | This document.                                                                |

### 3.2 Modified Files

**Frontend**

| File                                          | Change                                                                       |
|-----------------------------------------------|------------------------------------------------------------------------------|
| `services/firebaseClient.ts`                  | Added `functions: Functions = getFunctions(app, 'us-central1')` export plus `connectFunctionsEmulator(functions, 'localhost', 5001)` inside the emulator branch. |
| `services/geminiService.ts`                   | Complete rewrite. Every export is now an `httpsCallable` wrapper. New signatures: `remodelImage({ base64Image, instruction, projectName })` and `generateDesignImage({ prompt, aspectRatio, projectName })` return `ProxyImageResult` (the persisted gallery image metadata, including quota counters). `generateProductList`/`swapProduct` auto-convert input image from URL to base64 dataURL if needed via `toBase64DataUrl`. No more `new GoogleGenAI(...)` — the SDK is gone from the client bundle. |
| `services/dataService.ts`                     | Shopify Admin access token deleted. `fetchSpecificShopifyProduct` deleted. `findMatchingInventory` deleted (moved to `functions/src/lib/shopify.ts`). `fetchShopifyProducts` now returns the static `FALLBACK_INVENTORY` for the admin console. Mock `fetchUserDirectory` updated to the new `UserAccount` shape (was returning a subset of fields). `SHOPIFY_STORE_URL` kept for external-link construction in Gallery and ShopLookModal. |
| `services/galleryService.ts`                  | `uploadGalleryImage` deleted — `proxyRemodel`/`proxyGenerateImage` own the write. `dataUrlToBlob` helper deleted. Storage `uploadBytes` import dropped. Remaining surface: `subscribeToGallery` (now resolves `thumbnailUrl` from `thumbnailPath` via `getDownloadURL` per snapshot), `saveProductsToImage`, `deleteGalleryImage`. |
| `services/userService.ts`                     | `ensureUserDoc`, `recordRender`, and the `defaultUserDoc` helper deleted — server owns user-doc creation and quota mutation. Remaining surface: `subscribeToUser` only. |
| `components/Remodeler.tsx`                    | After successful remodel: stop calling `uploadGalleryImage`; use the URL + imageId returned by `proxyRemodel` directly. Set `resultImage` to the Firebase download URL (not base64). `onImageGenerated` callback synthesizes the local `GeneratedImage` from the proxy response so the UI flips immediately — the real Firestore doc arrives via the subscription. Quota-exceeded error path: the proxy throws `HttpsError("resource-exhausted")` with a human-readable message; Remodeler surfaces that verbatim via `alert`. |
| `components/Generator.tsx`                    | Updated to new `generateDesignImage({ prompt, aspectRatio })` signature. The component remains unused by the main App nav but compiles clean for future reactivation. |
| `App.tsx`                                     | `recordRender` import and call removed — quota is incremented inside the server-side `reserveRenderSlot` transaction. `handleImageGenerated` is now a no-op; the gallery subscription surfaces the new doc. |
| `firestore.rules`                             | `users/{userId}` update now rejects any change to: `tier`, `stripeCustomerId`, `subscriptionId`, `subscriptionStatus`, `currentPeriodEnd`, `renderTimestamps`, `totalRenders`, `monthlyDesignCount`, `monthlyResetAt`, `role`. `users/{userId}/gallery/{imageId}` — `create` is denied for clients; `update` is allowed for the owner but only when the diff is `hasOnly(['savedProducts'])`. The Functions runtime SA bypasses rules and continues to own these writes. |
| `firebase.json`                               | Added `"pubsub": { "port": 8085 }` to the emulators block so the scheduled `expireOldImages` actually runs locally. `functions` block added with a `predeploy` `npm --prefix functions run build` and a `source: "functions"` pointer. |
| `vite.config.ts`                              | Dropped the `define: { 'process.env.API_KEY': ..., 'process.env.GEMINI_API_KEY': ... }` block. `loadEnv` import removed. The client no longer has a way to read the Gemini key. |
| `.env.local`                                  | `GEMINI_API_KEY` line removed. Only Firebase web-config and the emulator flag remain. |
| `tsconfig.json`                               | Added `"vite/client"` to `compilerOptions.types` so `import.meta.env` type-checks during standalone `tsc --noEmit` runs. |
| `.gitignore`                                  | Added `functions/lib/` and `functions/.secret.local`. (`.emulator-data/` was added in Phase 2.) |

### 3.3 Infrastructure Additions

**Secret Manager** — two new secrets created via Terraform in Phase 0 and populated in Phase 3:

| Secret                  | Source code site                                                |
|-------------------------|-----------------------------------------------------------------|
| `gemini-api-key`        | `defineSecret('gemini-api-key')` in 6 of 9 Functions            |
| `shopify-access-token`  | `defineSecret('shopify-access-token')` in 3 Functions           |

Locally these resolve from `functions/.secret.local`. In prod they resolve from GCP Secret Manager and Functions auto-mount them as environment values at cold-start.

### 3.4 Data Model Additions to `users/{uid}/gallery/{imageId}`

Added by `onGalleryImageFinalize`:

```
thumbnailPath:   'gallery/{uid}/{imageId}_thumb.jpg'
```

Added at write time by the proxy Functions (already present from Phase 2 but now server-authoritative):

```
url:             <Firebase download URL with token in firebaseStorageDownloadTokens metadata>
storagePath:     'gallery/{uid}/{imageId}.png'
watermarked:     <true if tierAtCreation === 'freemium', and the PNG itself is overlaid>
expiresAt:       computeExpiresAt(createdAt, tier) — server uses the same shared/tiers.ts helper
```

### 3.5 New Constants on the Server Side

Imported from the shared module (`shared/tiers.ts` → copied into `functions/src/_shared/tiers.ts` at build):

```
QUOTA_BY_TIER = {
  freemium:  { monthly:  10, daily:           2 },
  basic:     { monthly: 100, daily:           5 },
  advanced:  { monthly: 300, daily: +Infinity },
  designer:  { monthly: +Infinity, daily: +Infinity },
}

RETENTION_DAYS_BY_TIER = {
  freemium:  1,
  basic:     7,
  advanced: 15,
  designer: 30,
}
```

`reserveRenderSlot` uses these directly. The cleanup job uses `RETENTION_DAYS_BY_TIER` indirectly via the `expiresAt` written at render time.

---

## 4. End-to-End Flows

### 4.1 Sign-Up → User Doc Creation (now server-owned)

1. User submits the signup form. `createUserWithEmailAndPassword` succeeds in Firebase Auth.
2. The Auth service fires a `user.create` event.
3. `onUserCreate` (Gen-1 Auth trigger) runs in ~200–500 ms with the new UID, email, and provider metadata.
4. It writes `users/{uid}` with all Freemium defaults — including `monthlyResetAt` set to the first of next UTC month.
5. The client's `subscribeToUser` listener fires with the new doc.
6. App.tsx transitions out of the loading state and renders the dashboard.

The client never holds the privilege to set `tier`. There is no client-side path that could produce a non-Freemium new user.

### 4.2 Remodel → Server Pipeline

1. User clicks Apply. `Remodeler.handleRemodel` calls `httpsCallable('proxyRemodel')` with `{ base64Image, instruction, projectName }`.
2. `proxyRemodel` opens a Firestore transaction:
   - Loads `users/{uid}`.
   - Resets the daily window if `Date.now() - lastDailyResetAt > 24h`.
   - Resets the monthly window if `Date.now() >= monthlyResetAt`.
   - Checks `monthlyUsed < QUOTA_BY_TIER[tier].monthly` and `dailyUsed < QUOTA_BY_TIER[tier].daily`.
   - If either fails: throws `HttpsError('resource-exhausted', '<human msg>', { reason })`. Transaction aborts; no counters change.
   - Otherwise: increments both counters + writes a fresh stamp into `renderTimestamps`.
3. Calls Gemini `gemini-2.5-flash-image` with the input PNG + instruction. ~10–20 s typical.
4. If Gemini throws or returns no inline data: `rollbackReservation(uid)` runs a corrective transaction (decrement counters, pop the last stamp). User is not charged a quota slot for an AI failure.
5. If `tier === 'freemium'`: `applyWatermark(buffer)` composites the SVG overlay onto the PNG.
6. `uploadAndGetDownloadURL` uploads to `gallery/{uid}/{imageId}.png`, sets the `firebaseStorageDownloadTokens` metadata UUID, returns the Firebase-style download URL.
7. Writes `users/{uid}/gallery/{imageId}` with all metadata, including `expiresAt = computeExpiresAt(createdAt, tier)`.
8. Returns `{ imageId, url, storagePath, watermarked, tier, monthlyUsed, monthlyLimit, dailyUsed, dailyLimit }` to the caller.
9. `onGalleryImageFinalize` Storage trigger fires asynchronously on the upload. It generates a 400×300 JPG thumbnail, uploads `gallery/{uid}/{imageId}_thumb.jpg`, and patches the Firestore doc with `thumbnailPath`.
10. Client's gallery subscription fires twice — once for the original write (with full-size URL), once for the thumbnail-path patch (which the client uses to resolve a `thumbnailUrl` via `getDownloadURL`).

### 4.3 Product Scan Inside ShopLookModal

1. User hovers the result image → clicks **Shop Furnishings**.
2. ShopLookModal opens; user picks a source.
3. ShopLookModal calls `generateProductList(image, source)`. `image` may be either a base64 dataURL (Generator path) or an `https://` Firebase Storage URL (Remodeler path). The client helper `toBase64DataUrl` converts URL → blob → dataURL once if needed before sending.
4. `httpsCallable('proxyGenerateProductList')` runs server-side: Gemini structured-JSON scan → for each detected item, `findMatchingInventory(name, source, shopifyToken)` → PRHOMZ source hits the live Shopify Admin API, falls back to fuzzy match against the local 5-item catalog, falls back to an `external_referral` linked to the Shopify storefront search. Amazon/Wayfair/IKEA always emit an `external_*` link.
5. The list returns to the client and renders into the modal.
6. User clicks Save Selection → `saveProductsToImage` writes `{ savedProducts }` to the gallery doc. The tightened Firestore rule permits this exact diff and rejects any other client write to the gallery doc.

### 4.4 Header Catalog Search

1. User types into the header search bar and hits enter.
2. App.tsx calls `searchCatalog(query)` → `proxyShopifySearch` callable.
3. Server: Gemini structured-JSON search → `findMatchingInventory` for each item → returns list.
4. Results render in the full-screen results overlay.

### 4.5 Hourly Cleanup

1. Pub/Sub triggers `expireOldImages` once an hour (emulator: minute-tick; prod: hourly via Cloud Scheduler).
2. Function runs a collection-group query for `gallery/*` docs where `expiresAt < now`.
3. For each match: deletes the Firestore doc, deletes the Storage object at `storagePath`, deletes the thumbnail at `thumbnailPath` if set. Failures on Storage delete are logged but non-fatal (the GCS lifecycle rule is the safety net).

---

## 5. Decisions Made During Phase 3

### 5.1 One callable per concern, instead of one super-callable

Each Gemini operation (remodel, generate, product list, search, swap, chat) is its own Function. This is more files but cleaner blast radius: a regression in `proxyChat` cannot break renders. Each Function has its own minimal memory allocation (`256MiB` for text, `512MiB` for image-touching ones) and its own timeout. The Functions emulator startup cost is per-deploy, not per-Function, so there is no startup penalty.

### 5.2 Quota enforced via Firestore transaction, not via a counter increment

A naive `FieldValue.increment(1)` would not see the current counter value; two concurrent renders would both succeed at limit-1 → limit+1, double-charging. The transaction in `reserveRenderSlot` reads, checks, writes atomically — Firestore retries the body on contention so the second caller sees the first's write and gets `resource-exhausted` correctly.

### 5.3 Rollback rather than pre-check

`reserveRenderSlot` increments before the Gemini call. If Gemini fails, `rollbackReservation` decrements. The alternative — call Gemini first, then increment — leaks render slots if the Function crashes between the Gemini response and the counter write. Reserve-then-rollback is the standard pattern for paid quota.

### 5.4 Watermark as SVG composite, not PNG asset

`applyWatermark` builds an SVG text overlay and uses `sharp.composite([...])` to lay it onto the PNG. This means:
- No binary asset to ship in the Function bundle.
- The text is sharp at any output resolution (SVG is vector).
- Adjusting font, opacity, or text is a one-line code change.

Tradeoff: every Freemium render incurs the cost of an SVG-to-PNG rasterize. `sharp` handles this in ~50–100 ms on Node 20, negligible against the ~10–20 s Gemini call.

### 5.5 Firebase-style download URLs server-side via a token in metadata

`uploadAndGetDownloadURL` writes a UUID to the Storage object's `firebaseStorageDownloadTokens` metadata field, then constructs `https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<path>?alt=media&token=<uuid>`. This is the same format the client SDK's `getDownloadURL` would produce, but the SA generates it directly so the proxy Function can return the URL in its response without a second round-trip.

In the emulator the host is rewritten to `http://127.0.0.1:9199`. The check happens automatically based on `FUNCTIONS_EMULATOR=true` (set by `firebase emulators:start`).

### 5.6 `onGalleryImageFinalize` listens on the named gallery bucket, not the default app bucket

Phase 0's Terraform created a custom bucket `prhomz-dev-code-test-gallery` rather than letting Firebase auto-provision `<project>.appspot.com`. The Storage trigger config has to explicitly name that bucket via `bucket: GALLERY_BUCKET` — the default behavior is to listen on the default bucket, which would mean the trigger silently fires for nothing.

### 5.7 Pub/Sub emulator port pinned in `firebase.json`

Without `"pubsub": { "port": 8085 }` in the emulators block, the scheduled `expireOldImages` is silently skipped with the log line *"function ignored because the pubsub emulator does not exist."* Documented because this is easy to miss on a fresh emulator setup.

### 5.8 Tightened rules use `hasOnly(['savedProducts'])` rather than blocking gallery `update` entirely

The cleanest theoretical model would forbid all client writes to gallery docs. But "Save Selection" needs to persist a small structured field; routing it through a `proxySaveProducts` callable is one network round-trip with no security benefit (the user already owns the doc). The rule lets exactly that one field through and nothing else, keeping the Save action snappy.

### 5.9 `proxyChat` requires auth + emailVerified

Gemini chat is text-only and does not consume render quota — it would be tempting to make it public. We keep auth + emailVerified gates anyway because the alternative is a free public Gemini text endpoint hanging off the production domain, which is a free Gemini-API gateway for any attacker who finds it. Cost protection > friction.

### 5.10 `userService.ts` shrunk to a single function

After removing `recordRender` and `ensureUserDoc`, the file is just `subscribeToUser`. Keeping the file (versus inlining the one helper into `App.tsx`) preserves the module boundary so Phase 4's Stripe-driven `subscriptionStatus` listeners can land alongside the existing user subscription without cross-module churn.

### 5.11 `dataService.ts` kept for the admin console only

The Shopify token + live API call are gone. What remains is the static 5-item `FALLBACK_INVENTORY` array exposed through `fetchShopifyProducts` so AdminDashboard's inventory tab keeps rendering. This is a stub until Phase 6 wires the admin to real Firestore data.

---

## 6. Testing Performed

All tests passed against the local Firebase Emulator Suite (with `--import=./.emulator-data --export-on-exit`) + paid-tier Gemini API key + the Shopify Admin token in `functions/.secret.local`:

| Test                                                                                  | Outcome |
|---------------------------------------------------------------------------------------|---------|
| Sign up → `onUserCreate` writes Firestore doc with Freemium defaults                  | Pass    |
| Tightened rules — manual attempt to set `tier: 'designer'` from Firestore client SDK | Rejected |
| Tightened rules — manual attempt to create a gallery doc client-side                  | Rejected |
| Tightened rules — `saveProductsToImage` (savedProducts-only diff) still works          | Pass    |
| Remodel → `proxyRemodel` writes gallery doc and increments quota counters             | Pass    |
| Remodel → Freemium output PNG has the visible "PRHOMZ • Freemium" watermark           | Pass    |
| Remodel → returned URL renders the watermarked image in the result pane               | Pass    |
| Remodel → `onGalleryImageFinalize` creates a JPG thumbnail at `*_thumb.jpg`           | Pass    |
| Gallery card uses the JPG thumbnail (faster initial paint vs. full PNG)              | Pass    |
| Render quota — second daily render on Freemium succeeds                              | Pass    |
| Render quota — third daily render on Freemium throws `resource-exhausted` cleanly    | Pass    |
| Resetting `renderTimestamps: []` and `monthlyDesignCount: 0` in Firestore UI restores quota | Pass |
| ShopLookModal source picker → `proxyGenerateProductList` returns list with `Source Accurate` badges for PRHOMZ matches | Pass |
| ShopLookModal swap icon → `proxySwapProduct` replaces a row with a new alternative   | Pass    |
| Header search bar → `proxyShopifySearch` returns a list and renders the results overlay | Pass |
| Assistant tab → `proxyChat` returns a designer-tone reply                            | Pass    |
| Save Selection → `savedProducts` field appears on the gallery doc                    | Pass    |
| Vite production build → `dist/assets/index-*.js` contains 0 occurrences of the Gemini API key (`AIzaSyBj…`) | Pass |
| Vite production build → 0 occurrences of the Shopify Admin token (`shpat_…`)         | Pass    |
| Vite production build → 0 occurrences of `GoogleGenAI` symbol                        | Pass    |
| Vite production build → `@google/genai` not pulled into the client bundle             | Pass    |
| `npx tsc --noEmit` (frontend) → clean                                                | Pass    |
| `npm run build` (functions) → clean                                                  | Pass    |
| Emulator startup → all 9 functions register (auth, storage, pubsub, 6 × http)        | Pass    |

The hourly `expireOldImages` was triggered manually (`curl http://127.0.0.1:5001/.../expireOldImages-0`) and confirmed to delete Firestore docs whose `expiresAt < now`. The full Cloud Scheduler path will be exercised in Phase 7 production smoke test.

---

## 7. What Was Not Built in Phase 3 (Intentionally Deferred)

| Item                                                | New phase | Reason for defer                                                                                                  |
|-----------------------------------------------------|-----------|-------------------------------------------------------------------------------------------------------------------|
| Stripe checkout, customer portal, webhook           | Phase 4   | Phase 3 scope was strictly server-side lockdown.                                                                  |
| Per-tier UI gating beyond the existing quota chip   | Phase 5   | Daily/monthly enforcement is server-side already; the UX nudges (upgrade modals, "you have 1 left" badges, retention countdowns) are a separate UX pass. |
| App Check enforcement on callables                  | Phase 7   | Requires a domain to register; emulator-only for now.                                                             |
| CORS tightening on the gallery bucket               | Phase 7   | Wildcard `*` is fine for dev; tighten to the prod domain at cutover.                                              |
| Replacing static admin data with real Firestore queries | Phase 6 | Out of scope.                                                                                                     |
| Watermark via a brand PNG asset rather than SVG     | Phase 7   | Current SVG overlay reads fine. Brand can hand in a finalized PNG before launch and `applyWatermark` swaps in one line. |
| Force-expire deletion path validated end-to-end     | Phase 7   | The function works in the emulator on a manual trigger; the prod Cloud Scheduler path is standard and low-risk.   |

---

## 8. Production Migration Checklist

What changes in production beyond Phase 2's checklist:

### 8.1 Push the Functions Bundle

```
firebase deploy --only functions --project prhomz-dev-code-test
```

First deploy takes ~3–5 minutes. The 9 Functions deploy to `us-central1`; the Gen-1 `onUserCreate` and Gen-2 functions deploy side by side without conflict. Subsequent deploys touching only one file take ~30 s.

### 8.2 Push the Updated Firestore Rules

```
firebase deploy --only firestore:rules --project prhomz-dev-code-test
```

This is critical — the tightened rules are what enforce the server-only invariants. Forgetting this step leaves the prod database wide open to client writes despite the bundled code being clean.

### 8.3 Confirm Secrets Are in Secret Manager

```
gcloud secrets list --project=prhomz-dev-code-test
gcloud secrets versions list gemini-api-key --project=prhomz-dev-code-test
gcloud secrets versions list shopify-access-token --project=prhomz-dev-code-test
```

Both should show at least one ENABLED version. The Functions runtime SA needs `roles/secretmanager.secretAccessor` on each, which Phase 0's Terraform already grants.

### 8.4 Verify the Functions Runtime Has the Right IAM

The Cloud Functions default SA needs:

- `roles/datastore.user` (Firestore read/write) — granted in Phase 0
- `roles/storage.objectAdmin` on `prhomz-dev-code-test-gallery` — granted in Phase 0
- `roles/secretmanager.secretAccessor` on each secret — granted in Phase 0
- `roles/pubsub.publisher` for the scheduled function — auto-granted when the schedule is deployed

A regression here will show as `PERMISSION_DENIED` in the Functions logs on first invocation.

### 8.5 Pub/Sub Schedule

`expireOldImages`'s schedule is registered automatically on `firebase deploy --only functions`. To confirm:

```
gcloud scheduler jobs list --location=us-central1 --project=prhomz-dev-code-test
```

Expected: one job with `firebase-schedule-expireOldImages-us-central1`, frequency `0 * * * *` or `every 1 hours`.

### 8.6 Front-end Build for Prod

The Phase 3 client bundle is safe to deploy as-is. Verify before pushing:

```
npx vite build
grep -c "AIzaSyBj_\|shpat_\|GoogleGenAI" dist/assets/*.js
```

Expected output: `0`. Any non-zero hit is a regression to investigate before deploy.

### 8.7 Watermark Swap-In (Optional)

If brand provides a finalized watermark PNG, drop it in `functions/src/lib/` and change one line in `applyWatermark.ts`:

```ts
// Before (current — SVG overlay):
const overlay = Buffer.from(svgString);
return sharp(input).composite([{ input: overlay, gravity: 'southeast' }]).png().toBuffer();

// After (PNG asset):
import * as path from 'path';
const overlay = path.join(__dirname, 'watermark.png');
return sharp(input).composite([{ input: overlay, gravity: 'southeast' }]).png().toBuffer();
```

No other code changes; the rest of the pipeline is unchanged.

### 8.8 App Check Coverage Extension

When Phase 7 enables App Check, add coverage to all six callable Functions and the storage trigger. The toggle is in the Firebase Console, one click per resource. Without it, anyone with a sniffed Firebase web config can call your prod callables.

---

## 9. Known Limitations

| Limitation                                                  | Severity | Mitigation                                |
|-------------------------------------------------------------|----------|-------------------------------------------|
| `proxyChat` is unmetered (no quota)                         | Low      | Auth + emailVerified are the only gates; Phase 5 may add a daily message cap |
| Watermark text style is hardcoded                           | Low      | One-line swap-in in Phase 7              |
| `proxyGenerateProductList` and `proxyShopifySearch` share no client-visible rate limit | Low | They are auth-gated and Gemini-API-cost-bound; abuse risk is small |
| Static admin inventory in `dataService.ts` is divorced from real Shopify state | Low | Phase 6 replaces admin dashboard data sources |
| `proxyChat` model id `gemini-3.1-pro-preview` is a preview model | Low | Swap to GA model when Google publishes it |
| `findMatchingInventory` PRHOMZ-source path issues 1 live Shopify request per AI-detected item — N items per scan = N round trips | Medium | Acceptable for typical scan size (5–10 items); Phase 6 could batch-fetch the catalog once and match locally |
| App Check is not enforced yet                                | Medium   | Phase 7                                   |

---

## 10. Cost Impact

Phase 3 introduces serverless compute spending in addition to Phase 2's Gemini-driven cost. Pricing is at `us-central1`:

### 10.1 Cloud Functions Invocations

- Invocations: $0.40 per million above free tier (2M/month free)
- GB-seconds: $0.0000025 per GB-s above free tier
- GHz-seconds: $0.0000100 per GHz-s above free tier

At 1,000 active users × 100 renders/month × ~15 s execution at 512 MB:
- Invocations: 100K total (Functions touch + scan + chat); well inside free tier.
- GB-seconds: 100K × 15 × 0.5 = 750K GB-s ≈ free-tier consumed; a few dollars above.

Functions cost at this scale is in the **single-dollar range monthly**, dominated by the Gemini API ($400-ish from Phase 2 calculation).

### 10.2 Secret Manager

- $0.06 per 10K access operations.

Each Function cold start reads its referenced secrets once. With ~10 cold starts per Function per day × 9 Functions × 30 days = 2700 reads/month. Negligible (well under $0.01).

### 10.3 Pub/Sub for the Scheduled Function

- $40 per TiB of message data; first 10 GB free.

`expireOldImages` fires hourly with a tiny payload. Effectively $0.

### 10.4 Cloud Scheduler

- First 3 jobs free, then $0.10 per job per month.

We have one job (`expireOldImages`). $0.

### 10.5 Net New Phase 3 Monthly Cost (dev scale)

**Under $1/month.** Production scale doesn't push past Functions free tier until ~10,000 active users at current usage shape.

---

## 11. Files Changed Summary

```
New (Cloud Functions):
  functions/package.json
  functions/tsconfig.json
  functions/.secret.local                (gitignored)
  functions/.gitignore
  functions/src/index.ts
  functions/src/onUserCreate.ts
  functions/src/onGalleryImageFinalize.ts
  functions/src/expireOldImages.ts
  functions/src/proxyRemodel.ts
  functions/src/proxyGenerateImage.ts
  functions/src/proxyGenerateProductList.ts
  functions/src/proxyShopifySearch.ts
  functions/src/proxySwapProduct.ts
  functions/src/proxyChat.ts
  functions/src/lib/quota.ts
  functions/src/lib/watermark.ts
  functions/src/lib/storage.ts
  functions/src/lib/shopify.ts

New (root):
  shared/tiers.ts                        (promoted to shared source of truth)
  phase-3-completion-report.md

Modified (frontend):
  services/firebaseClient.ts             (+ functions client + emulator wire)
  services/geminiService.ts              (rewrite — all callables)
  services/dataService.ts                (Shopify access stripped)
  services/galleryService.ts             (uploadGalleryImage removed)
  services/userService.ts                (ensureUserDoc + recordRender removed)
  components/Remodeler.tsx               (uses proxyRemodel response directly)
  components/Generator.tsx               (new generateDesignImage signature)
  App.tsx                                (recordRender call removed)
  firestore.rules                        (lock server fields + gallery create)
  firebase.json                          (pubsub:8085 + functions block)
  vite.config.ts                         (define block removed)
  .env.local                             (GEMINI_API_KEY removed)
  tsconfig.json                          (added vite/client types)
  .gitignore                             (functions/lib, .secret.local)

Total: 18 new files + 14 modified files. ~1,200 lines of net code added; ~250 lines removed (client-side Gemini/Shopify code that moved server-side).
```

---

## 12. Sign-Off

| Item                                                | Verified |
|-----------------------------------------------------|----------|
| All 9 Cloud Functions register and run in the emulator | Yes   |
| Server creates user doc with Freemium defaults      | Yes      |
| Server enforces daily and monthly quota atomically  | Yes      |
| Server applies real watermark on Freemium PNGs       | Yes      |
| Server generates JPG thumbnails on upload           | Yes      |
| Server cleans up expired gallery docs               | Yes (manual trigger; scheduled path is standard) |
| Client cannot write `tier`, `monthlyDesignCount`, `subscriptionStatus`, `role` | Yes |
| Client cannot create a gallery doc directly         | Yes      |
| Client can still save selected products to a gallery doc | Yes  |
| Gemini API key is not present in the client bundle  | Yes      |
| Shopify Admin token is not present in the client bundle | Yes  |
| `@google/genai` SDK is not present in the client bundle | Yes  |
| Frontend TypeScript checks pass                     | Yes      |
| Frontend production build succeeds                  | Yes      |
| Functions TypeScript build is clean                 | Yes      |
| Phase 1 and 2 deliverables still work               | Yes      |

**Phase 3 status: complete. Ready for Phase 4.**

---

## 13. What Phase 4 Will Add

Phase 4 is the **monetization phase** — Stripe is the only third-party integration. Scope:

- **Stripe products and price IDs** for Basic ($9.99), Advanced ($19.99), Designer ($49.99). Freemium is a "no-subscription" state in our model and doesn't exist in Stripe.
- **Stripe Customer linking** — `onUserCreate` is extended to create a Stripe Customer at sign-up and store the `stripeCustomerId` on the user doc.
- **Stripe Checkout Session callable** — `proxyCreateCheckoutSession({ priceId })`. Returns the hosted Checkout URL; client redirects.
- **Stripe Customer Portal callable** — `proxyCreateCustomerPortalSession()`. Returns the portal URL for upgrade/downgrade/cancel.
- **Stripe Webhook handler** — HTTP function that verifies the Stripe signature and updates `users/{uid}.tier`, `.subscriptionStatus`, `.currentPeriodEnd`, `.subscriptionId` on `customer.subscription.created/updated/deleted` events. This is the only way `tier` ever changes for a Client account.
- **`recomputeExpiry(uid)`** — utility called from the webhook on tier change to push existing gallery docs out to the new retention window (or pull them in on downgrade). Same constant source as everywhere else.
- **Pricing UI** — a new screen that lists the three paid tiers, calls `proxyCreateCheckoutSession`, and shows the Freemium summary card for unauthenticated viewers.
- **Webhook secret** stored in Secret Manager as `stripe-webhook-secret`. Stripe API key stored as `stripe-secret-key`.
- **Local Stripe CLI integration** for emulator-side webhook delivery.

After Phase 4, every tier change in the system flows through the Stripe webhook, and the user doc reflects the truth of the subscription state in real time.

Phase 3 deliverables remain unchanged through Phase 4.
