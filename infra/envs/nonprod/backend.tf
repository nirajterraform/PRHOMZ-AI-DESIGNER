terraform {
  backend "gcs" {
    bucket = "prhomzmvp-nonprod-tfstate"
    prefix = "envs/nonprod"
  }
}
