output "project_id" {
  value = var.project_id
}

output "region" {
  value = var.region
}

output "gallery_bucket" {
  value = google_storage_bucket.gallery.name
}

output "firestore_database" {
  value = google_firestore_database.default.name
}

output "runtime_sa_email" {
  value = google_service_account.cloud_run_runtime.email
}

output "firebase_web_app_id" {
  value = google_firebase_web_app.default.app_id
}

output "firebase_web_config" {
  description = "Paste these values into the frontend .env.local"
  value = {
    apiKey            = data.google_firebase_web_app_config.default.api_key
    authDomain        = data.google_firebase_web_app_config.default.auth_domain
    projectId         = var.project_id
    storageBucket     = google_storage_bucket.gallery.name
    messagingSenderId = try(data.google_firebase_web_app_config.default.messaging_sender_id, "")
    appId             = google_firebase_web_app.default.app_id
    measurementId     = try(data.google_firebase_web_app_config.default.measurement_id, "")
  }
  sensitive = true
}

output "secret_ids" {
  value = {
    gemini_api_key        = google_secret_manager_secret.gemini_api_key.id
    shopify_access_token  = google_secret_manager_secret.shopify_access_token.id
    stripe_secret_key     = google_secret_manager_secret.stripe_secret_key.id
    stripe_webhook_secret = google_secret_manager_secret.stripe_webhook_secret.id
  }
}

output "api_image_repository" {
  description = "Artifact Registry path for pushing built images. Tag the image like <this>:<sha>."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.api.repository_id}"
}

output "api_service_url" {
  description = "Public URL of the api Cloud Run service. Set VITE_API_BASE_URL to this in the frontend."
  value       = google_cloud_run_v2_service.api.uri
}

output "stripe_webhook_url" {
  description = "Public URL of the stripe-webhook Cloud Run service. Register this in the Stripe dashboard (test mode) → Add endpoint → <url>/webhook."
  value       = google_cloud_run_v2_service.stripe_webhook.uri
}

output "dashboard_url" {
  description = "Direct URL to the monitoring dashboard."
  value       = "https://console.cloud.google.com/monitoring/dashboards/custom/${google_monitoring_dashboard.prhomz.id}?project=${var.project_id}"
}
