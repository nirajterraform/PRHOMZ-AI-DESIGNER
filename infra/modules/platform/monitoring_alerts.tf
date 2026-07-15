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

# Alert on ANY Stripe webhook signature failure in a 10-min window (7.8).
# Signature failures return 401 so the 5xx alert never fires on them; a single
# one warrants a look (secret mismatch after rotation, or a spoof attempt).
resource "google_monitoring_alert_policy" "webhook_signature_failures" {
  project      = var.project_id
  display_name = "stripe-webhook: signature failures (>0 in 10min)"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "signature_failures"

    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND metric.type = \"logging.googleapis.com/user/${google_logging_metric.webhook_signature_failure_count.name}\""
      duration        = "0s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0

      aggregations {
        alignment_period   = "600s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  notification_channels = local.notification_channel_ids

  documentation {
    content   = "One or more Stripe webhook signature verifications failed. If you just rotated the webhook signing secret, redeploy stripe-webhook with the new stripe-webhook-secret version. Otherwise investigate — it may be a spoofing attempt against the public /webhook endpoint."
    mime_type = "text/markdown"
  }

  depends_on = [google_logging_metric.webhook_signature_failure_count]
}

# Alert on a burst of upstream Gemini failures (7.9) — >3 in 5 min points at a
# quota/429 or Gemini outage, i.e. renders broadly failing, before users pile up.
resource "google_monitoring_alert_policy" "gemini_failures_burst" {
  project      = var.project_id
  display_name = "api: Gemini failures burst (>3 in 5min)"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "gemini_failures"

    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND metric.type = \"logging.googleapis.com/user/${google_logging_metric.gemini_call_failed_count.name}\""
      duration        = "0s"
      comparison      = "COMPARISON_GT"
      threshold_value = 3

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  notification_channels = local.notification_channel_ids

  documentation {
    content   = "More than 3 Gemini call failures in 5 min. Likely Gemini quota/429 or an upstream outage — image generation is broadly failing. Check the api logs for `gemini_call_failed` error details and the Gemini/Vertex quota dashboard."
    mime_type = "text/markdown"
  }

  depends_on = [google_logging_metric.gemini_call_failed_count]
}
