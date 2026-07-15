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

# Counts Stripe webhook signature-verification failures (7.8). These return 401
# (not 5xx), so the webhook_5xx alert misses them — a spike means either a
# secret-rotation mismatch or a spoofing attempt. Alerted on in monitoring_alerts.tf.
resource "google_logging_metric" "webhook_signature_failure_count" {
  project = var.project_id
  name    = "webhook_signature_failure_count"
  filter  = <<-EOT
    resource.type = "cloud_run_revision"
    AND resource.labels.service_name = "stripe-webhook"
    AND jsonPayload.event = "stripe_webhook_failed"
    AND jsonPayload.error =~ "signature verification failed"
  EOT

  metric_descriptor {
    metric_kind  = "DELTA"
    value_type   = "INT64"
    display_name = "Stripe webhook signature failures"
  }
}

# Counts upstream Gemini call failures (7.9). A burst usually means Gemini
# quota/429 or an outage — i.e. "all renders failing" — so alert early.
resource "google_logging_metric" "gemini_call_failed_count" {
  project = var.project_id
  name    = "gemini_call_failed_count"
  filter  = <<-EOT
    resource.type = "cloud_run_revision"
    AND resource.labels.service_name = "api"
    AND jsonPayload.event = "gemini_call_failed"
  EOT

  metric_descriptor {
    metric_kind  = "DELTA"
    value_type   = "INT64"
    display_name = "Gemini call failures"
  }
}
