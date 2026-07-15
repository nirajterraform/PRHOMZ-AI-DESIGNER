resource "google_firestore_database" "default" {
  project                           = var.project_id
  name                              = "(default)"
  location_id                       = var.region
  type                              = "FIRESTORE_NATIVE"
  concurrency_mode                  = "OPTIMISTIC"
  app_engine_integration_mode       = "DISABLED"
  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_ENABLED"
  delete_protection_state           = "DELETE_PROTECTION_DISABLED"

  depends_on = [
    google_project_service.apis,
    google_firebase_project.default,
  ]
}

# Daily managed Firestore backups with 7-day retention (6.7). Complements PITR
# (enabled above): PITR covers the last 7 days at minute granularity, while
# these are restorable daily snapshots.
resource "google_firestore_backup_schedule" "daily" {
  project   = var.project_id
  database  = google_firestore_database.default.name
  retention = "604800s" # 7 days

  daily_recurrence {}

  depends_on = [google_firestore_database.default]
}
