module "platform" {
  source = "../../modules/platform"

  project_id       = var.project_id
  region           = var.region
  alert_emails     = var.alert_emails
  geofence_enabled = var.geofence_enabled
  stripe_price_ids = var.stripe_price_ids
  app_url          = var.app_url
}
