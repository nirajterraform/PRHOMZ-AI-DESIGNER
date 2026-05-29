resource "google_artifact_registry_repository" "api" {
  project       = var.project_id
  location      = var.region
  repository_id = "api"
  description   = "Docker images for the PRHOMZ Cloud Run API + Stripe webhook (single image, PROCESS_TYPE selects entry point)."
  format        = "DOCKER"

  depends_on = [google_project_service.apis]
}

resource "google_artifact_registry_repository_iam_member" "cloud_build_writer" {
  project    = var.project_id
  location   = google_artifact_registry_repository.api.location
  repository = google_artifact_registry_repository.api.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
}

resource "google_artifact_registry_repository_iam_member" "cloud_build_default_writer" {
  project    = var.project_id
  location   = google_artifact_registry_repository.api.location
  repository = google_artifact_registry_repository.api.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${data.google_project.project.number}@cloudbuild.gserviceaccount.com"
}

# On newer projects, `gcloud builds submit` uses the Compute Engine default SA
# as the build runtime. It needs broad Cloud Build permissions to read source
# from the build-staging bucket and write logs.
resource "google_project_iam_member" "compute_sa_cloud_build_builder" {
  project = var.project_id
  role    = "roles/cloudbuild.builds.builder"
  member  = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
}

data "google_project" "project" {
  project_id = var.project_id
}
