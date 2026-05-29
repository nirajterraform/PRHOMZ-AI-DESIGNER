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
