output "project_id" {
  value = module.platform.project_id
}

output "region" {
  value = module.platform.region
}

output "gallery_bucket" {
  value = module.platform.gallery_bucket
}

output "firestore_database" {
  value = module.platform.firestore_database
}

output "runtime_sa_email" {
  value = module.platform.runtime_sa_email
}

output "firebase_web_app_id" {
  value = module.platform.firebase_web_app_id
}

output "firebase_web_config" {
  value     = module.platform.firebase_web_config
  sensitive = true
}

output "secret_ids" {
  value = module.platform.secret_ids
}

output "api_image_repository" {
  value = module.platform.api_image_repository
}

output "api_service_url" {
  value = module.platform.api_service_url
}

output "stripe_webhook_url" {
  value = module.platform.stripe_webhook_url
}

output "dashboard_url" {
  value = module.platform.dashboard_url
}
