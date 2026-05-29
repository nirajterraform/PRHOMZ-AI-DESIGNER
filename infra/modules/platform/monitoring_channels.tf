resource "google_monitoring_notification_channel" "email" {
  for_each = toset(var.alert_emails)

  project      = var.project_id
  display_name = "Email - ${each.value}"
  type         = "email"

  labels = {
    email_address = each.value
  }

  # Don't auto-disable on TF re-apply — once verified, channels survive.
  force_delete = false

  depends_on = [google_project_service.apis]
}

locals {
  notification_channel_ids = [for c in google_monitoring_notification_channel.email : c.id]
}
