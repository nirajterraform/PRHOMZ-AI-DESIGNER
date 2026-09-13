variable "project_id" {
  description = "GCP project ID (pre-created in console, billing already linked)"
  type        = string
}

variable "region" {
  description = "Primary region for Firestore, Storage, and Cloud Run. Permanent for Firestore once set."
  type        = string
  default     = "us-central1"
}

variable "app_name" {
  description = "Display name for the Firebase web app"
  type        = string
  default     = "PRHOMZ AI Designer"
}

variable "image_retention_days" {
  description = "Safety-net max retention (days) enforced by GCS bucket lifecycle. Set to the highest tier's window (Designer = 30). Per-tier deletion (Freemium 1 / Basic 7 / Advanced 15 / Designer 30) is enforced by the scheduled expireOldImages Cloud Run job — this lifecycle rule only catches anything the job misses."
  type        = number
  default     = 30
}

variable "api_image" {
  description = "Full image reference for the Cloud Run services. Leave empty to bootstrap with a placeholder built by `gcloud builds submit`; gcloud run deploy updates the image post-bootstrap, and TF ignores image changes after that."
  type        = string
  default     = ""
}

variable "geofence_enabled" {
  description = "Whether Shop the Look enforces the US-only geofence. Defaults to true so production keeps enforcing it; staging sets false in its terraform.tfvars. The MaxMind DB is baked into the image either way, so flipping this back on needs no rebuild."
  type        = bool
  default     = true
}

variable "stripe_price_ids" {
  description = "Per-tier Stripe Price ID overrides, e.g. { basic = \"price_…\", advanced = \"price_…\", designer = \"price_…\" }. Rendered as STRIPE_PRICE_<TIER> env vars on both Cloud Run services. Leave empty in production so shared/pricing.ts keeps its live defaults; staging sets its sandbox IDs here."
  type        = map(string)
  default     = {}
}

variable "alert_emails" {
  description = "List of email addresses to receive monitoring alerts. Each gets its own notification channel and a one-time verification email. Add/remove members by editing the env's terraform.tfvars; no other changes needed."
  type        = list(string)
  default     = []
}
