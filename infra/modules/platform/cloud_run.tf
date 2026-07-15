locals {
  # Bootstrap with a well-known public image so first `terraform apply` works
  # before any custom image has been built. After B.6 (first build + deploy),
  # gcloud manages the image and TF ignores it via the lifecycle block below.
  api_image = var.api_image != "" ? var.api_image : "us-docker.pkg.dev/cloudrun/container/hello"
}

# --- API service (proxy routes + internal routes) ---

resource "google_cloud_run_v2_service" "api" {
  project  = var.project_id
  location = var.region
  name     = "api"
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloud_run_runtime.email

    scaling {
      # min=1 keeps a warm instance so first-request cold starts don't hurt UX.
      min_instance_count = 1
      max_instance_count = 10
    }

    timeout = "120s"

    containers {
      # Bootstrap image — `gcloud run deploy --image=...` updates this after first build.
      image = local.api_image

      resources {
        limits = {
          memory = "1Gi"
          cpu    = "1"
        }
      }

      env {
        name  = "PROCESS_TYPE"
        value = "api"
      }
      env {
        name  = "GALLERY_BUCKET"
        value = google_storage_bucket.gallery.name
      }
      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }
      # Non-prod skips strict audience checking on OIDC tokens.
      # Tighten in prod by setting EXPECTED_OIDC_AUDIENCE to the service URL.
      env {
        name  = "EXPECTED_AUDIENCE_OPTIONAL"
        value = "true"
      }
      # Shop the Look US-only geofence (MaxMind GeoLite2 baked into the image).
      # Managed here so `terraform apply` doesn't wipe the gcloud-set value.
      env {
        name  = "GEOFENCE_ENABLED"
        value = "true"
      }

      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.gemini_api_key.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "SHOPIFY_ACCESS_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.shopify_access_token.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "STRIPE_SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.stripe_secret_key.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      # gcloud run deploy after each image build manages this.
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  depends_on = [
    google_project_service.apis,
    google_artifact_registry_repository.api,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "api_public" {
  project  = google_cloud_run_v2_service.api.project
  location = google_cloud_run_v2_service.api.location
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# --- Stripe webhook service (separate Cloud Run service, same image) ---

resource "google_cloud_run_v2_service" "stripe_webhook" {
  project  = var.project_id
  location = var.region
  name     = "stripe-webhook"
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloud_run_runtime.email

    scaling {
      # min=1 so Stripe webhook deliveries never hit a cold start (a dropped/slow
      # delivery = subscription state drift). Stripe retries, but keep it warm.
      min_instance_count = 1
      max_instance_count = 5
    }

    timeout = "60s"

    containers {
      image = local.api_image

      resources {
        limits = {
          memory = "512Mi"
          cpu    = "1"
        }
      }

      env {
        name  = "PROCESS_TYPE"
        value = "webhook"
      }
      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }

      env {
        name = "STRIPE_SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.stripe_secret_key.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "STRIPE_WEBHOOK_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.stripe_webhook_secret.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  depends_on = [
    google_project_service.apis,
    google_artifact_registry_repository.api,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "webhook_public" {
  project  = google_cloud_run_v2_service.stripe_webhook.project
  location = google_cloud_run_v2_service.stripe_webhook.location
  name     = google_cloud_run_v2_service.stripe_webhook.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
