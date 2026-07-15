resource "google_secret_manager_secret" "gemini_api_key" {
  project   = var.project_id
  secret_id = "gemini-api-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "shopify_access_token" {
  project   = var.project_id
  secret_id = "shopify-access-token"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "stripe_secret_key" {
  project   = var.project_id
  secret_id = "stripe-secret-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "stripe_webhook_secret" {
  project   = var.project_id
  secret_id = "stripe-webhook-secret"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

# MaxMind GeoLite2 license key — used at BUILD time (cloudbuild.yaml) to download
# the country DB baked into the api image. Not consumed by any running service.
# Version is added out-of-band via gcloud (see runbook). If created via gcloud
# before the next apply, import with:
#   terraform import module.platform.google_secret_manager_secret.maxmind_license_key projects/prhomzmvp-nonprod/secrets/maxmind-license-key
resource "google_secret_manager_secret" "maxmind_license_key" {
  project   = var.project_id
  secret_id = "maxmind-license-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}
