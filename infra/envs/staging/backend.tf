terraform {
  backend "gcs" {
    bucket = "prhomzmvp-staging-505019-tfstate"
    prefix = "envs/staging"
  }
}
