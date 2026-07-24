resource "google_service_account" "cloud_run_runtime" {
  project      = var.project_id
  account_id   = "cloud-run-runtime"
  display_name = "Cloud Run Runtime"
  description  = "Runtime SA for PRHOMZ Cloud Run services (Vertex/Shopify/Stripe proxies, scheduled jobs, event handlers)"

  depends_on = [google_project_service.apis]
}

resource "google_project_iam_member" "runtime_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.cloud_run_runtime.email}"
}

resource "google_storage_bucket_iam_member" "runtime_gallery_admin" {
  bucket = google_storage_bucket.gallery.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cloud_run_runtime.email}"
}

resource "google_project_iam_member" "runtime_vertex_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.cloud_run_runtime.email}"
}

resource "google_secret_manager_secret_iam_member" "runtime_gemini" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.gemini_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run_runtime.email}"
}

resource "google_secret_manager_secret_iam_member" "runtime_shopify" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.shopify_access_token.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run_runtime.email}"
}

resource "google_secret_manager_secret_iam_member" "runtime_stripe_secret" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.stripe_secret_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run_runtime.email}"
}

resource "google_secret_manager_secret_iam_member" "runtime_stripe_webhook" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.stripe_webhook_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run_runtime.email}"
}

# Lets the webhook read the SendGrid key to send cancellation emails.
# Created via gcloud 2026-07-24; import before apply:
#   terraform import 'module.platform.google_secret_manager_secret_iam_member.runtime_sendgrid' "projects/prhomzmvp-nonprod/secrets/sendgrid-api-key roles/secretmanager.secretAccessor serviceAccount:cloud-run-runtime@prhomzmvp-nonprod.iam.gserviceaccount.com"
resource "google_secret_manager_secret_iam_member" "runtime_sendgrid" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.sendgrid_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run_runtime.email}"
}

resource "google_project_iam_member" "runtime_auth_admin" {
  project = var.project_id
  role    = "roles/firebaseauth.admin"
  member  = "serviceAccount:${google_service_account.cloud_run_runtime.email}"
}

resource "google_project_iam_member" "runtime_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.cloud_run_runtime.email}"
}

resource "google_project_iam_member" "runtime_metric_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.cloud_run_runtime.email}"
}

resource "google_project_iam_member" "runtime_trace_agent" {
  project = var.project_id
  role    = "roles/cloudtrace.agent"
  member  = "serviceAccount:${google_service_account.cloud_run_runtime.email}"
}
