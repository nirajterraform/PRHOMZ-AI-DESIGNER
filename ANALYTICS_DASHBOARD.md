# PRHOMZ AI Designer — Analytics Dashboard (GA4 + Looker Studio)

Build spec for the stakeholder telemetry dashboard, mapping the "Product Analytics &
Database Metrics Report" template to our real stack.

> **Scope decision (2026-08-22): built from EXISTING telemetry only — ZERO changes to the
> designer app.** The dashboard is assembled in GA4 / Looker Studio from events the app
> already fires + Firestore. No new UI, no new code, no deploy.

## Data sources
- **GA4** property **`546952075`** ("PRHOMZ AI"), designer stream `G-CBYYMXGPRR` — event/engagement metrics.
- **Firestore** (`prhomzmvp-nonprod`) — authoritative DB counts (registered users, tiers, renders, saved designs).
- **BigQuery** (`prhomzmvp-nonprod`, API already enabled) — GA4 raw export for deeper analysis (optional).

## Access (GA4 property 546952075)
| Person | Role |
|---|---|
| niraj.sriwastava@gmail.com | Admin |
| mverma197802@gmail.com | Viewer |
| singhrathour.arun@gmail.com | Viewer |

## Existing GA4 events (already firing in production — nothing to add)
`sign_up`, `select_style {style_id, style_name}`, `generate_design {style_id, budget}`,
`compare_slider_used`, `shop_look_open`, `select_product {item_name, price, has_url}`,
`save_look {items}`, `download_design`. Plus GA4 native metrics (users, new users, active users).

## Metric mapping (report template → source)
| Report metric | Source | Status |
|---|---|---|
| Total Registered Users | Firestore `users` count | 🟢 available |
| New Registrations (30d) | Firestore `createdAt >= now-30d` | 🟢 available |
| MAU / DAU | GA4 Active Users (28-day / 1-day) | 🟢 available |
| Tier breakdown | Firestore `tier` group-by | 🟢 available |
| Total Renders | Firestore gallery count / GA4 `generate_design` | 🟢 available |
| Avg Renders per Active User | derived (renders ÷ MAU) | 🟢 available |
| Saved Designs | Firestore gallery `savedProducts` present | 🟢 available |
| By Design Preset/Style | GA4 `select_style` / `generate_design.style_id` | 🟢 available |
| By Room Type | Firestore gallery `projectName` | 🟢 available |
| Shop-the-Look Triggers | GA4 `shop_look_open` | 🟢 available |
| Users Reaching Shopping List | GA4 `shop_look_open` (proxy) | 🟢 available |
| Items Added to Shopping List | GA4 `save_look.items` | 🟢 available |
| Total Outbound Product Clicks | GA4 `select_product` | 🟢 available |
| Click-Through Rate | derived (`select_product` ÷ `shop_look_open`) | 🟢 available |
| Downloads | GA4 `download_design` | 🟢 available |
| **Design Refinements (create vs refine)** | not distinguished in the existing event | 🔴 needs code (declined — no app change) |
| **Outbound PRHOMZ vs Amazon split** | existing `select_product` has no destination | 🔴 needs code (declined — no app change) |
| **Total AI-detected products / avg per render** | not logged | 🔴 needs code (declined — no app change) |
| **Satisfaction / thumbs up-down (§6)** | requires a rating control on the page | 🔴 needs UI (declined — no app change) |

## Step 1 — Link GA4 → BigQuery (niraj, GA4 Admin — optional, for deep analysis)
1. GA4 → **Admin** → **Product links** → **BigQuery links** → **Link**.
2. Choose project **`prhomzmvp-nonprod`** → data location **us** → enable **Daily** export → **Submit**.
> BigQuery API already enabled. First export lands ~24h later in dataset `analytics_546952075`.
> Not required for the Looker Studio build below (GA4 connector is direct) — only for SQL-level analysis.

## Step 2 — Build the Looker Studio dashboard (direct GA4 connector)
1. https://lookerstudio.google.com → **Create → Report** → **Google Analytics** connector → property `546952075`.
2. Share with mverma197802 + singhrathour.arun (Viewer).
3. Pages & tiles (all from existing telemetry):
   - **① Users & Subscriptions** — scorecards: Total users, New users (30d), Active users (28-day MAU, 1-day DAU); pie: users by tier (Firestore figure, or a manual note until Firestore→BQ is added).
   - **② Render Usage** — scorecards: `generate_design`, `download_design`; bar: by `style_id`; (room-type from Firestore).
   - **③ Shop-the-Look Funnel** — funnel: `shop_look_open` → `select_product` → `save_look`; CTR = select_product ÷ shop_look_open.
4. **Firestore truth-numbers** (exact registered users / tier counts / renders): pull via aggregation (see the user/usage report effort) or add a Firestore→BigQuery source later.

## Notes for the stakeholder (template items we intentionally are NOT building)
Per the decision to make **zero changes to the designer app**, these template items can't be
populated without adding tracking/UI to the product, so they're **out of scope** for now:
- **§6 User Feedback & Ratings** (thumbs up/down, satisfaction score) — needs a rating control on each render.
- **Outbound PRHOMZ-vs-Amazon breakdown** — needs a destination tag on the product-click event.
- **AI-detected product counts / create-vs-refine split** — needs new events.

If the stakeholder wants any of these, they require a small product change (some invisible, ratings visible),
which we can schedule as a normal release.
