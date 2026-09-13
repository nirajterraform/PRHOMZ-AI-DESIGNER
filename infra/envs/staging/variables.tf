variable "project_id" {
  description = "GCP project ID (pre-created in console, billing already linked)"
  type        = string
}

variable "region" {
  description = "Primary region for Firestore, Storage, and Cloud Run"
  type        = string
  default     = "us-central1"
}

variable "billing_account_id" {
  description = "Billing account ID linked to the project (informational only, not managed)"
  type        = string
}

variable "alert_emails" {
  description = "Emails that receive monitoring alerts (5xx spike, p95 latency, scheduler failure, uptime check)."
  type        = list(string)
  default     = ["niraj.sriwastava@gmail.com"]
}

variable "stripe_price_ids" {
  description = "Per-tier Stripe Price ID overrides for this environment. Staging points at its Stripe test sandbox; prod leaves this empty so shared/pricing.ts keeps the live IDs."
  type        = map(string)
  default     = {}
}

variable "geofence_enabled" {
  description = "Whether Shop the Look enforces the US-only geofence. Staging sets this false in terraform.tfvars; the module defaults to true so production is unaffected when staging merges to main."
  type        = bool
  default     = true
}
