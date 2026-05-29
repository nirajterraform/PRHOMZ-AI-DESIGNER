# Log-based metrics. These count specific log events for dashboards and
# (later) custom SLO definitions. They don't generate alerts on their own.

# Counts every successful image generation (proxyGenerateImage + proxyRemodel
# both return 200 from the api service on success).
resource "google_logging_metric" "image_generation_count" {
  project = var.project_id
  name    = "image_generation_count"
  filter  = <<-EOT
    resource.type = "cloud_run_revision"
    AND resource.labels.service_name = "api"
    AND httpRequest.status = 200
    AND (httpRequest.requestUrl =~ ".*/proxyGenerateImage.*"
         OR httpRequest.requestUrl =~ ".*/proxyRemodel.*")
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    display_name = "Successful image generations"
  }
}

# Counts quota-exceeded responses (429).
resource "google_logging_metric" "quota_exceeded_count" {
  project = var.project_id
  name    = "quota_exceeded_count"
  filter  = <<-EOT
    resource.type = "cloud_run_revision"
    AND resource.labels.service_name = "api"
    AND httpRequest.status = 429
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    display_name = "Quota exceeded (429) responses"
  }
}

# Counts checkout sessions created.
resource "google_logging_metric" "checkout_started_count" {
  project = var.project_id
  name    = "checkout_started_count"
  filter  = <<-EOT
    resource.type = "cloud_run_revision"
    AND resource.labels.service_name = "api"
    AND httpRequest.status = 200
    AND httpRequest.requestUrl =~ ".*/proxyCreateCheckoutSession.*"
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    display_name = "Checkout sessions started"
  }
}
