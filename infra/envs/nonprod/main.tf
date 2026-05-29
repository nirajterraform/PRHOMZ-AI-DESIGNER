module "platform" {
  source = "../../modules/platform"

  project_id   = var.project_id
  region       = var.region
  alert_emails = var.alert_emails
}
