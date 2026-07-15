resource "google_monitoring_uptime_check_config" "api_health" {
  project      = var.project_id
  display_name = "api /health"
  timeout      = "10s"
  period       = "300s"

  http_check {
    path           = "/health"
    port           = "443"
    use_ssl        = true
    validate_ssl   = true
    request_method = "GET"
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = replace(replace(google_cloud_run_v2_service.api.uri, "https://", ""), "http://", "")
    }
  }

  selected_regions = ["USA_OREGON", "USA_IOWA", "USA_VIRGINIA"]

  depends_on = [
    google_project_service.apis,
    google_cloud_run_v2_service.api,
  ]
}

resource "google_monitoring_alert_policy" "uptime_failure" {
  project      = var.project_id
  display_name = "api: uptime check failing"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "uptime_check_failed"

    condition_threshold {
      filter = <<-EOT
        resource.type = "uptime_url"
        AND metric.type = "monitoring.googleapis.com/uptime_check/check_passed"
        AND metric.label.check_id = "${google_monitoring_uptime_check_config.api_health.uptime_check_id}"
      EOT
      duration        = "120s"
      comparison      = "COMPARISON_LT"
      threshold_value = 1.0

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_FRACTION_TRUE"
        cross_series_reducer = "REDUCE_MEAN"
        group_by_fields      = ["resource.label.host"]
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = local.notification_channel_ids

  documentation {
    content   = "The api Cloud Run service /health endpoint failed uptime checks for >2 min. Likely causes: container crash, deploy regression, networking outage. Check Cloud Run logs and recent deploys."
    mime_type = "text/markdown"
  }

  depends_on = [google_monitoring_uptime_check_config.api_health]
}

# --- stripe-webhook uptime (7.3) ---
# Webhook downtime = silent revenue leak (subscription state stops updating),
# so probe its /health endpoint the same way as the api service.
resource "google_monitoring_uptime_check_config" "webhook_health" {
  project      = var.project_id
  display_name = "stripe-webhook /health"
  timeout      = "10s"
  period       = "300s"

  http_check {
    path           = "/health"
    port           = "443"
    use_ssl        = true
    validate_ssl   = true
    request_method = "GET"
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = replace(replace(google_cloud_run_v2_service.stripe_webhook.uri, "https://", ""), "http://", "")
    }
  }

  selected_regions = ["USA_OREGON", "USA_IOWA", "USA_VIRGINIA"]

  depends_on = [
    google_project_service.apis,
    google_cloud_run_v2_service.stripe_webhook,
  ]
}

resource "google_monitoring_alert_policy" "webhook_uptime_failure" {
  project      = var.project_id
  display_name = "stripe-webhook: uptime check failing"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "webhook_uptime_check_failed"

    condition_threshold {
      filter = <<-EOT
        resource.type = "uptime_url"
        AND metric.type = "monitoring.googleapis.com/uptime_check/check_passed"
        AND metric.label.check_id = "${google_monitoring_uptime_check_config.webhook_health.uptime_check_id}"
      EOT
      duration        = "120s"
      comparison      = "COMPARISON_LT"
      threshold_value = 1.0

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_FRACTION_TRUE"
        cross_series_reducer = "REDUCE_MEAN"
        group_by_fields      = ["resource.label.host"]
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = local.notification_channel_ids

  documentation {
    content   = "The stripe-webhook Cloud Run service /health endpoint failed uptime checks for >2 min. While down, Stripe subscription events aren't processed and tier/state drifts. Check Cloud Run logs and recent deploys."
    mime_type = "text/markdown"
  }

  depends_on = [google_monitoring_uptime_check_config.webhook_health]
}
