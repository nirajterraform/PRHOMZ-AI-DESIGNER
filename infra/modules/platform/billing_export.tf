# BigQuery dataset that will receive Cloud Billing's detailed-cost export.
# The export itself is enabled at the BILLING ACCOUNT level (not the project),
# which TF can't do — see manual step in the dataset description.
#
# After enabling the export:
#   - Detailed cost rows arrive ~24h after billing events
#   - Each row breaks down by service, SKU, project, label, region, day
#   - Query directly in BigQuery or build a Looker Studio dashboard on top

resource "google_bigquery_dataset" "billing_export" {
  project       = var.project_id
  dataset_id    = "billing_export"
  friendly_name = "Cloud Billing detailed-cost export"
  description   = "Receives Cloud Billing usage cost data. Enable export at https://console.cloud.google.com/billing/export — point at this dataset."
  location      = "US"

  # Retain data: billing data is small (~MB/month for non-prod), keep forever.
  default_table_expiration_ms = null

  depends_on = [google_project_service.apis]
}

output "billing_export_dataset" {
  description = "BigQuery dataset id for Cloud Billing export. Configure the export at https://console.cloud.google.com/billing/export with this dataset."
  value       = google_bigquery_dataset.billing_export.dataset_id
}
