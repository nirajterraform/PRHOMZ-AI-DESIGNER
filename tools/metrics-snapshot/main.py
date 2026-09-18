"""Daily metrics snapshot → BigQuery (stakeholder dashboard).

Runs as the cloud-run-runtime service account (Firestore read + BigQuery write).
Streams the small `users` collection, computes summary counts, and appends one row
to `dashboard_metrics.daily_metrics`. Only AGGREGATES are written — no PII leaves
Firestore. Triggered daily by Cloud Scheduler (OIDC-authenticated HTTP).
"""
import datetime
import functions_framework
from google.cloud import firestore
from google.cloud import bigquery

PROJECT = "prhomzmvp-nonprod"
DATASET = "dashboard_metrics"
TABLE = "daily_metrics"
TIERS = ("freemium", "basic", "advanced", "designer")


@functions_framework.http
def snapshot_metrics(request):
    db = firestore.Client(project=PROJECT)

    total = 0
    tier_counts = {t: 0 for t in TIERS}
    total_renders = 0
    new_7 = 0
    new_30 = 0
    with_render = 0

    # `createdAt` on the user doc is epoch MILLISECONDS (see api/src/onUserCreate.ts).
    # Counting the windows here rather than deriving them from BigQuery history means
    # the 30-day number is exact from day one, instead of waiting for 30 rows to exist.
    now_ms = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
    cutoff_7 = now_ms - 7 * 86400 * 1000
    cutoff_30 = now_ms - 30 * 86400 * 1000

    # The users collection is small; streaming + counting in-process avoids any
    # aggregation-API/index concerns and stays cheap.
    for doc in db.collection("users").stream():
        data = doc.to_dict() or {}
        # Skip soft-deleted accounts so counts reflect live users.
        if data.get("deletedAt"):
            continue
        total += 1
        tier = data.get("tier")
        if tier in tier_counts:
            tier_counts[tier] += 1
        try:
            renders = int(data.get("totalRenders") or 0)
        except (TypeError, ValueError):
            renders = 0
        total_renders += renders
        # Activation: how many accounts ever produced a design.
        if renders > 0:
            with_render += 1
        created = data.get("createdAt")
        if isinstance(created, (int, float)):
            if created >= cutoff_30:
                new_30 += 1
            if created >= cutoff_7:
                new_7 += 1

    row = {
        "snapshot_date": datetime.date.today().isoformat(),
        "registered_users": total,
        "tier_freemium": tier_counts["freemium"],
        "tier_basic": tier_counts["basic"],
        "tier_advanced": tier_counts["advanced"],
        "tier_designer": tier_counts["designer"],
        "total_renders": total_renders,
        "new_users_7d": new_7,
        "new_users_30d": new_30,
        "users_with_render": with_render,
        "captured_at": datetime.datetime.utcnow().isoformat(),
    }

    bq = bigquery.Client(project=PROJECT)
    table_id = f"{PROJECT}.{DATASET}.{TABLE}"
    errors = bq.insert_rows_json(table_id, [row])
    if errors:
        return (f"BigQuery insert errors: {errors}", 500)
    return (f"OK: {row}", 200)
