# PRHOMZ Launch-Day Smoke Test — 25 Jul 2026

**Execute in order. Don't tag v1.0.0 or announce until every ✅ passes.**
**App:** https://designer.prhomzai.com  **Landing:** https://prhomzai.com

---

## Phase 0 — Pre-flight (before wiping / go-live)
- [ ] **Confirm live Stripe keys** active (not test) — a real card will be charged in Phase 4
- [ ] **Confirm Sentry** dashboard open in a tab (watch for errors during testing)
- [ ] **Confirm you have:** a throwaway email for signup, a real payment card, a phone (iPhone Safari + Android Chrome)
- [ ] **Note current rollback points** (from RUNBOOK): api rev, stripe-webhook rev, landing rev, last Firebase Hosting release

## Phase 1 — Wipe test/dummy data (§5.1–5.3)
> ⚠️ Point-of-no-return. Do this only once you're committed to going live today.
- [ ] **§5.1** Delete test users + test gallery docs from Firestore (`users/*`, `users/{uid}/gallery/*`)
- [ ] **§5.2** Delete test images from Storage (`gs://prhomzmvp-nonprod-gallery/gallery/*`)
- [ ] **§5.3** Delete dummy **Stripe test** customers/subscriptions (note: live mode uses different IDs — verify you're clearing the right mode)
- [ ] Confirm app still loads with an empty gallery (no orphaned references)

## Phase 2 — Core user journey (§12.1, 12.2, 12.9)
- [ ] **§12.9** On **https://prhomzai.com**, click the **Designer** CTA → lands on **designer.prhomzai.com** (branded URL, not `*.web.app`)
- [ ] **§12.1** Sign up with a fresh email → **verification email arrives in inbox** (not spam). Check Gmail. Note delivery time.
  - _Fail? → SendGrid activity + Firebase Auth logs_
- [ ] Complete the **mandatory profile fields** (first name/last name/gender/age/zip/country) + password reveal toggle works
- [ ] Click verification link → returns to app, verified
- [ ] **§12.2** Redeem a **free render** → image generates successfully
  - _Fail? → Sentry + api logs (Vertex/Gemini call)_

## Phase 3 — Gallery, Shop the Look, geofence (§12.5)
- [ ] **§12.5** Generated render appears in **Gallery**
- [ ] Open a render → **Shop the Look** works → **sourcing modal** opens (PRHOMZ + Amazon links)
- [ ] **Geofence sanity:** from a **US IP** Shop the Look shows products; (optional) from a **non-US IP/VPN** it shows the region-block message
  - _Note: geofence fails OPEN — if MaxMind can't resolve, it allows. That's intended._

## Phase 4 — Payments (§12.3, 12.4)  ⚠️ real money
- [ ] **§12.3** Subscribe to a paid tier with a **real card** → payment succeeds, tier upgrades in-app
  - _Watch: Stripe Dashboard (live) → payment appears; stripe-webhook logs → subscription event processed_
- [ ] **§12.4** Open **Customer Portal** → **cancel** → confirm "cancels at period end" → in-app tier still active until period end
- [ ] (If safe) verify a **proration/switch** between tiers behaves correctly
- [ ] Refund the real test charge afterward if desired (policy = no refund for users, but this is your own test charge)

## Phase 5 — Feedback & account lifecycle (§12.6, 12.7)
- [ ] **§12.6** Submit the **feedback form** → row appears in Firestore `feedback` collection
- [ ] **§12.7** **Delete account** → user is soft-deleted, signed out, and **cannot sign back in**
  - _Verify: `users/{uid}` has `deletedAt`/`hardDeleteAt`; sign-in is blocked_

## Phase 6 — Mobile (§12.8)
Repeat the **core journey** (signup → render → gallery → Shop the Look → subscribe/portal) on:
- [ ] **iPhone Safari** — all flows work, layout intact, signup form scrolls
- [ ] **Android Chrome** — all flows work, layout intact

## Phase 7 — Go-live sign-off (§11.1)
- [ ] All above ✅ and **Sentry shows no new errors** from the test run
- [ ] **§11.1** Tag **`v1.0.0`** on **both** repos:
  ```bash
  # Designer
  cd /Users/nirajsriwastava/PRHOMZ-AI-DESIGNER && git tag -a v1.0.0 -m "Production launch" && git push origin v1.0.0
  # Landing
  cd /Users/nirajsriwastava/PRHOMZ-AI-LANDING && git tag -a v1.0.0 -m "Production launch" && git push origin v1.0.0
  ```
- [ ] Update RUNBOOK rollback table with launch revisions
- [ ] **Announce launch** 🚀

---

## 🔴 Rollback triggers — abort go-live if:
- Verification emails don't arrive (users can't onboard)
- Payment succeeds but tier doesn't upgrade (webhook broken)
- Renders fail consistently (Vertex/Gemini/quota issue)
- Sentry shows a crash-loop on a core flow

**Rollback:** re-route Cloud Run traffic to the previous revision (RUNBOOK §11.2 — instant, no rebuild). Frontend: Firebase Hosting → roll back to prior release.

---

_Covers checklist §5.1–5.3 (wipe), §11.1 (tag), and §12.1–12.9 (smoke tests) in execution order._
