# Allow the GCS service agent to publish events to Pub/Sub (required for any
# Eventarc trigger sourced from Cloud Storage).
data "google_storage_project_service_account" "gcs_account" {
  project = var.project_id

  depends_on = [google_project_service.apis]
}

resource "google_project_iam_member" "gcs_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${data.google_storage_project_service_account.gcs_account.email_address}"
}

# Runtime SA needs eventReceiver to be invoked by Eventarc.
resource "google_project_iam_member" "runtime_event_receiver" {
  project = var.project_id
  role    = "roles/eventarc.eventReceiver"
  member  = "serviceAccount:${google_service_account.cloud_run_runtime.email}"
}

# Trigger SA (cloud-run-runtime) needs bucket-level read to subscribe to GCS
# notifications. Object-level admin (already granted) is not sufficient — the
# storage.buckets.get perm only lives on bucket-scoped roles.
resource "google_storage_bucket_iam_member" "runtime_gallery_bucket_reader" {
  bucket = google_storage_bucket.gallery.name
  role   = "roles/storage.legacyBucketReader"
  member = "serviceAccount:${google_service_account.cloud_run_runtime.email}"
}

# Eventarc service agent needs to validate the bucket during trigger creation.
# `google_project_service_identity` (google-beta) provisions the agent if not
# already created, then we grant it bucket-reader.
resource "google_project_service_identity" "eventarc" {
  provider = google-beta
  project  = var.project_id
  service  = "eventarc.googleapis.com"

  depends_on = [google_project_service.apis]
}

resource "google_storage_bucket_iam_member" "eventarc_gallery_bucket_reader" {
  bucket = google_storage_bucket.gallery.name
  role   = "roles/storage.legacyBucketReader"
  member = "serviceAccount:${google_project_service_identity.eventarc.email}"
}

resource "google_eventarc_trigger" "gallery_finalize" {
  project  = var.project_id
  location = var.region
  name     = "gallery-finalize"

  matching_criteria {
    attribute = "type"
    value     = "google.cloud.storage.object.v1.finalized"
  }
  matching_criteria {
    attribute = "bucket"
    value     = google_storage_bucket.gallery.name
  }

  destination {
    cloud_run_service {
      service = google_cloud_run_v2_service.api.name
      region  = var.region
      path    = "/internal/onGalleryFinalize"
    }
  }

  service_account = google_service_account.cloud_run_runtime.email

  depends_on = [
    google_project_service.apis,
    google_project_iam_member.gcs_pubsub_publisher,
    google_project_iam_member.runtime_event_receiver,
    google_storage_bucket_iam_member.runtime_gallery_bucket_reader,
    google_storage_bucket_iam_member.eventarc_gallery_bucket_reader,
    google_cloud_run_v2_service.api,
  ]
}
