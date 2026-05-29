resource "google_storage_bucket" "gallery" {
  provider = google-beta
  project  = var.project_id
  name     = "${var.project_id}-gallery"
  location = var.region

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = false
  }

  lifecycle_rule {
    condition {
      age = var.image_retention_days
    }
    action {
      type = "Delete"
    }
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "POST", "PUT", "DELETE", "HEAD"]
    response_header = ["Content-Type", "Authorization"]
    max_age_seconds = 3600
  }

  depends_on = [google_project_service.apis]
}

resource "google_firebase_storage_bucket" "gallery" {
  provider  = google-beta
  project   = var.project_id
  bucket_id = google_storage_bucket.gallery.id

  depends_on = [
    google_firebase_project.default,
    google_storage_bucket.gallery,
  ]
}
