# Looker Studio — Build Sheet (PRHOMZ AI Designer Analytics)

Step-by-step to finish the stakeholder dashboard. Companion to `ANALYTICS_DASHBOARD.md`
(which holds the metric mapping and scope decision).

**Report:** "PRHOMZ AI Designer Analytics" — https://lookerstudio.google.com/navigation/reporting
**Sign in as:** `niraj.sriwastava@gmail.com` (GA4 Admin + project owner + bigquery.admin)

> Record the report URL at the bottom of this file once you open it, so it is never lost again.

> **This repository is public.** Actual metric values (user counts, render totals, tier
> split, per-person usage) are deliberately omitted throughout. Where a step says to
> check a number, read the live value off the dashboard or BigQuery rather than
> expecting a figure here. Keep the real numbers in internal notes, not in this file.

---

## Access facts (verified 2026-09-08)

| Person | GCP project role | GA4 role | Can query BigQuery? |
|---|---|---|---|
| niraj.sriwastava@gmail.com | owner + bigquery.admin | Admin | ✅ yes |
| mverma197802@gmail.com (Manoj) | owner | Viewer | ✅ yes |
| singhrathour.arun@gmail.com (Arun) | **none** | Viewer | ❌ **no** |

**⚠️ Because Arun has no GCP access, every BigQuery data source MUST be set to
"Owner's credentials".** With "Viewer's credentials" his tiles render as permission errors.
This is the single most common way this build breaks.

---

## Data sources

**A. GA4** (already connected) — property `546952075`, "PRHOMZ AI".
Carries **both** the landing and designer streams — see Step 3.

**B. BigQuery** (to add) — the Firestore truth-numbers, refreshed daily at 05:00 UTC by the
`metrics-snapshot` Cloud Run job via Cloud Scheduler `metrics-snapshot-daily`.

```
Project : prhomzmvp-nonprod
Dataset : dashboard_metrics
Tables  : latest_metrics   (VIEW — single row, current values)
          daily_metrics    (TABLE — one row per day, for trends)

Fields  : snapshot_date (DATE), registered_users (INT), tier_freemium (INT),
          tier_basic (INT), tier_advanced (INT), tier_designer (INT),
          total_renders (INT), captured_at (TIMESTAMP)
```

History starts **2026-08-25**. Anything needing a 30-day lookback from BigQuery is
incomplete until ~2026-09-24 — use GA4 `sign_up` instead where noted.

---

## STEP 1 — Add the BigQuery data source  ← *do this first, it's the actual stakeholder ask*

1. Open the report → **Resource** → **Manage added data sources** → **Add a data source**.
2. Choose the **BigQuery** connector.
3. **My Projects** → `prhomzmvp-nonprod` → dataset `dashboard_metrics` → table `latest_metrics`.
4. Click **Add**.
5. Back in **Manage added data sources**, find the new source → **Edit** →
   set **Data credentials** to **Owner's credentials** → **Done**.
   *(Skip this and Arun's tiles break.)*
6. Repeat steps 2–5 for `daily_metrics` (needed for trend charts).

**Verify:** the field list shows `registered_users`, `total_renders`, `tier_freemium`…

---

## STEP 2 — Build page ① "Users & Subscriptions"

Add a new page: **Page** → **New page**. Rename it `Users & Subscriptions`.

### 2a. Registered Users scorecard — *the headline number*
- **Add a chart** → **Scorecard**
- Data source: `latest_metrics`
- Metric: `registered_users`, aggregation **MAX**
- Rename label to **Registered Users**
- ✅ Should match the live account count (cross-check the `users` collection in Firestore)

### 2b. Total Renders (Firestore truth) scorecard
- Scorecard · source `latest_metrics` · metric `total_renders` · aggregation **MAX**
- Label: **Total Renders (all time)**
- ✅ Should match the all-time render total in `latest_metrics`

> Note this will NOT match the GA4 "Total Renders" tile on page 1 — that one counts the
> `generate_design` event inside the selected date range. Label them distinctly
> ("Total Renders (all time)" vs "Renders (period)") or stakeholders will report a bug.

### 2c. Registered-users trend
- **Time series** chart · source `daily_metrics`
- Dimension: `snapshot_date` · Metric: `registered_users` (MAX)
- ✅ Rises monotonically across the snapshot history (starting 2026-08-25)

### 2d. Tier split pie — *needs a custom query*
Tier counts are stored as **columns**, so a pie chart can't bind to them directly.
Create a new data source using a custom query:

**Add a data source** → **BigQuery** → **CUSTOM QUERY** → project `prhomzmvp-nonprod` → paste:

```sql
SELECT 'Freemium' AS tier, tier_freemium AS users
FROM `prhomzmvp-nonprod.dashboard_metrics.latest_metrics`
UNION ALL SELECT 'Basic',    tier_basic    FROM `prhomzmvp-nonprod.dashboard_metrics.latest_metrics`
UNION ALL SELECT 'Advanced', tier_advanced FROM `prhomzmvp-nonprod.dashboard_metrics.latest_metrics`
UNION ALL SELECT 'Designer', tier_designer FROM `prhomzmvp-nonprod.dashboard_metrics.latest_metrics`
```

- Set **Owner's credentials** on it too.
- **Pie chart** · Dimension `tier` · Metric `users` (SUM)
- ✅ Should show one slice per tier, summing to the registered-user total

### 2e. New Registrations (30d)
Use **GA4**, not BigQuery (BQ history is too short until ~Sep 24).
- Scorecard · source **GA4** · Metric: **Event count** · Filter: `Event name` = `sign_up`
- Label: **New Registrations (30d)** · date range: Last 28 days

---

## STEP 3 — Fix the visitor scorecards (data-quality bug)

The page-1 visitor tiles show an implausibly high new-visitor share (near 100%), because
landing-page traffic swamps the designer. Property `546952075` carries both streams.

For **each** of Total Visitors, New Visitors, and DAU/MAU:
1. Select the tile → **Filter** → **Add a filter** → **Create a filter**
2. Name: `Designer only`
3. Condition: **Include** · Field `Hostname` · **Contains** · `designer.prhomzai.com`
4. Save, then reuse the same saved filter on the other tiles.

**Do NOT filter** the event tiles (`generate_design`, `select_style`, `compare_slider_used`,
`download_design`, the funnel) — those events only fire in the designer already.

**Expect the numbers to drop sharply and DAU/MAU to rise** — that is the fix working, not a
regression. Tell the stakeholders before they see it.

---

## STEP 4 — Fix the Shop-the-Look funnel page

Current problems: both charts share one title, and the right-hand chart is sorted by value so
`select_product` sits above `shop_look_open`, which reads as a broken funnel.

1. **Rename** the charts: "Shop-the-Look — Users" and "Shop-the-Look — Events".
2. On **both**: **Sort** → set to the funnel's logical order, or disable auto-sort
   (Sort by the dimension, ascending, and order the events `shop_look_open` →
   `select_product` → `save_look`).
3. **Widen** the charts or enable label wrapping — labels currently truncate to `shop_…`.
4. Add a **CTR scorecard**: `select_product ÷ shop_look_open`
   - Expect the by-users figure to sit below 100% and the by-events figure to exceed it.
   - Add a caption explaining >100% by events is expected — users click several products per open.

---

## STEP 5 — Remaining breakdowns (read the caveats)

### 5a. Renders by style — ⚠️ needs GA4 setup first, and is NOT retroactive
`style_id` is an **event parameter**, and Looker Studio can't see it until it's registered as a
custom dimension in GA4:

1. GA4 → **Admin** → **Custom definitions** → **Create custom dimension**
2. Scope **Event** · Event parameter `style_id` · name it `style_id`
3. Repeat for any others you want (`style_name`, `budget`, `item_name`, `price`, `items`)

> **Custom dimensions only collect from the moment you create them — they do not backfill.**
> The by-style chart will be empty for historical data and start filling ~24h after creation.
> Create them now even if you build the chart later.

Then: **Bar chart** · source GA4 · Dimension `style_id` · Metric Event count ·
Filter `Event name` = `generate_design`.

### 5b. Signup conversion
Scorecard with a calculated field, **after** Step 3's hostname filter is in place:
`sign_up event count ÷ designer Total Visitors`. Meaningless before the filter — the
denominator would be landing traffic.

### 5c. By room type — ⚠️ not available yet
Room type lives in Firestore (`projectName`) and is **not** in the summary table.
Requires extending `tools/metrics-snapshot/main.py` to aggregate by room and adding a
column. Ask Claude to do this — it's a small pipeline change plus a BigQuery schema update.

### 5d. Avg renders per active user
Calculated field: `total_renders ÷ active users`. Mixes BigQuery and GA4 sources, so it needs
either a blended data source or a manual note. Lowest priority.

---

## STEP 6 — Share with stakeholders

1. **Share** → add `mverma197802@gmail.com` and `singhrathour.arun@gmail.com` as **Viewer**.
2. Confirm Step 1.5 (Owner's credentials) is set on **every** BigQuery source — otherwise
   Arun's tiles error.
3. Best practice: open the report in an incognito window signed in as a non-owner to confirm
   what they actually see.

---

## Verification checklist

Check each tile against the live source rather than a figure recorded here (public repo —
see the note at the top). Take a dated snapshot of these values into internal notes when
you build, so future runs have a baseline to compare against.

| Tile | How to verify | Source |
|---|---|---|
| Registered Users | equals the live `users` count in Firestore (excluding soft-deleted) | BigQuery |
| Tier split | slices sum to Registered Users | BigQuery |
| Total Renders (all time) | equals `total_renders` in `latest_metrics` | BigQuery |
| Users trend | rises monotonically from 2026-08-25 onward | BigQuery |
| Total Visitors (after hostname filter) | drops sharply vs unfiltered | GA4 |
| DAU/MAU (after filter) | rises vs unfiltered | GA4 |
| CTR by users | below 100% | GA4 |

---

## Talking points for the stakeholder meeting

*(Figures deliberately omitted — public repo. Pull the current numbers from the dashboard
when preparing the meeting.)*

**1. Visitors ≠ accounts.** GA4 "Total Users" means *visitors*; the BigQuery figure is the
account count. Putting them side by side without labels is the most likely source of confusion.

**2. The email outage is visible in the render chart.** Renders sat completely flat for four
days (2026-09-01 to 09-04) while the SendGrid quota was exhausted and no one could verify
their account; both renders and signups recovered immediately after the fix. Worth proposing
an alert on renders going flat — it was a silent revenue-affecting outage that nothing caught.

**3. Team accounts inflate engagement.** Internal team accounts make up a large share of all
renders. Quote external usage separately, or the engagement numbers read substantially better
than reality. Identify the team account IDs from internal notes before the meeting.

**4. Out of scope by the 2026-08-22 zero-app-change decision** — satisfaction/thumbs ratings,
PRHOMZ-vs-Amazon outbound split, AI-detected product counts, create-vs-refine. Each needs a
product change; schedule as a normal release if wanted.

---

## Report URL

**https://lookerstudio.google.com/reporting/1e580e5b-367f-4c2b-989b-9e6719621e7a/page/WED7F**

Report ID `1e580e5b-367f-4c2b-989b-9e6719621e7a`. Owned by `niraj.sriwastava@gmail.com`.
(Also reachable via the legacy `datastudio.google.com/u/0/reporting/…` form, which redirects.)

Pages: **Definitions** · **Overview** · **Users & Subscriptions** · **Shop-the-Look Funnel**.
Shared as Viewer with `mverma197802@gmail.com` and `singhrathour.arun@gmail.com`.
