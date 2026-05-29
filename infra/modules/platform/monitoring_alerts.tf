# Alert when api 5xx count exceeds 2 in 5 min. Threshold = 2 (not 1) avoids
# pages on single transient 5xx; catches the scheduler's hourly-retry pattern
# (which produces ~4 5xx in a burst) that the previous threshold of 5 missed.
resource "google_monitoring_alert_policy" "api_5xx_spike" {
  project      = var.project_id
  display_name = "api: 5xx spike (>2 in 5min)"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "5xx_count"

    condition_threshold {
      filter = <<-EOT
        resource.type = "cloud_run_revision"
        AND resource.label.service_name = "api"
        AND metric.type = "run.googleapis.com/request_count"
        AND metric.label.response_code_class = "5xx"
      EOT
      duration        = "60s"
      comparison      = "COMPARISON_GT"
      threshold_value = 2

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  notification_channels = local.notification_channel_ids

  documentation {
    content   = "More than 5 5xx responses from the api service in a 5-minute window. Inspect Cloud Logging for the underlying error events (filter `severity>=ERROR jsonPayload.event!=\"\"`)."
    mime_type = "text/markdown"
  }
}

# Alert when api p95 latency exceeds 10s for 5 min. Image gen can take ~6s,
# so this catches genuinely slow / hanging requests, not normal load.
resource "google_monitoring_alert_policy" "api_high_latency" {
  project      = var.project_id
  display_name = "api: p95 latency > 10s (5min)"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "p95_latency"

    condition_threshold {
      filter = <<-EOT
        resource.type = "cloud_run_revision"
        AND resource.label.service_name = "api"
        AND metric.type = "run.googleapis.com/request_latencies"
      EOT
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 10000

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_DELTA"
        cross_series_reducer = "REDUCE_PERCENTILE_95"
      }
    }
  }

  notification_channels = local.notification_channel_ids

  documentation {
    content   = "p95 latency on api > 10s for 5 min. Either Gemini is slow, Firestore is overloaded, or there's a cold-start storm. Check trace and Cloud Run revision concurrency."
    mime_type = "text/markdown"
  }
}

# Alert when the stripe-webhook service returns 5xx.
resource "google_monitoring_alert_policy" "webhook_5xx" {
  project      = var.project_id
  display_name = "stripe-webhook: any 5xx (5min)"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "webhook_5xx"

    condition_threshold {
      filter = <<-EOT
        resource.type = "cloud_run_revision"
        AND resource.label.service_name = "stripe-webhook"
        AND metric.type = "run.googleapis.com/request_count"
        AND metric.label.response_code_class = "5xx"
      EOT
      duration        = "0s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  notification_channels = local.notification_channel_ids

  documentation {
    content   = "stripe-webhook returned a 5xx. Stripe retries on its own (within their retry budget) but persistent 5xx means subscription state drifts. Check signature verification and webhook secret rotation."
    mime_type = "text/markdown"
  }
}

# Scheduler-specific alert intentionally omitted — when expire-old-images fails,
# it returns 5xx from /internal/expireOldImages on the api Cloud Run service,
# which the api_5xx_spike alert above already catches. Re-adding a dedicated
# scheduler alert later would just produce duplicate pages for the same incident.
