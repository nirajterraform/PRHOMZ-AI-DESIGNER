resource "google_cloud_scheduler_job" "expire_old_images" {
  project          = var.project_id
  region           = var.region
  name             = "expire-old-images"
  description      = "Hourly sweep that deletes gallery docs (and Storage objects) past expiresAt"
  schedule         = "0 * * * *"
  time_zone        = "Etc/UTC"
  attempt_deadline = "180s"

  retry_config {
    retry_count          = 3
    min_backoff_duration = "30s"
    max_backoff_duration = "300s"
    max_doublings        = 2
  }

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.api.uri}/internal/expireOldImages"

    oidc_token {
      service_account_email = google_service_account.cloud_run_runtime.email
      audience              = google_cloud_run_v2_service.api.uri
    }

    headers = {
      "Content-Type" = "application/json"
    }
    body = base64encode("{}")
  }

  depends_on = [
    google_project_service.apis,
    google_cloud_run_v2_service.api,
  ]
}

# Daily cleanup that hard-deletes accounts past their 30-day soft-delete grace
# period (6.9). Same OIDC pattern as expire-old-images.
resource "google_cloud_scheduler_job" "hard_delete_accounts" {
  project          = var.project_id
  region           = var.region
  name             = "hard-delete-accounts"
  description      = "Daily sweep that hard-deletes accounts past hardDeleteAt (gallery, storage, Stripe customer, user doc, Auth record)"
  schedule         = "30 3 * * *"
  time_zone        = "Etc/UTC"
  attempt_deadline = "300s"

  retry_config {
    retry_count          = 3
    min_backoff_duration = "30s"
    max_backoff_duration = "300s"
    max_doublings        = 2
  }

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.api.uri}/internal/hardDeleteExpiredAccounts"

    oidc_token {
      service_account_email = google_service_account.cloud_run_runtime.email
      audience              = google_cloud_run_v2_service.api.uri
    }

    headers = {
      "Content-Type" = "application/json"
    }
    body = base64encode("{}")
  }

  depends_on = [
    google_project_service.apis,
    google_cloud_run_v2_service.api,
  ]
}
