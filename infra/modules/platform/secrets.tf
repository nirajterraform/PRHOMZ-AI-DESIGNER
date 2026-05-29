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
