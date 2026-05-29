resource "google_monitoring_dashboard" "prhomz" {
  project = var.project_id

  dashboard_json = jsonencode({
    displayName  = "PRHOMZ — nonprod"
    mosaicLayout = {
      columns = 12
      tiles   = [
        {
          width  = 6
          height = 4
          widget = {
            title       = "api requests/min by status"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter             = "resource.type=\"cloud_run_revision\" resource.label.service_name=\"api\" metric.type=\"run.googleapis.com/request_count\""
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_RATE"
                      groupByFields      = ["metric.label.response_code_class"]
                      crossSeriesReducer = "REDUCE_SUM"
                    }
                  }
                }
                plotType = "STACKED_AREA"
              }]
              timeshiftDuration = "0s"
            }
          }
        },
        {
          xPos   = 6
          width  = 6
          height = 4
          widget = {
            title = "api latency p50 / p95 / p99"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"cloud_run_revision\" resource.label.service_name=\"api\" metric.type=\"run.googleapis.com/request_latencies\""
                      aggregation = {
                        alignmentPeriod    = "60s"
                        perSeriesAligner   = "ALIGN_DELTA"
                        crossSeriesReducer = "REDUCE_PERCENTILE_50"
                      }
                    }
                  }
                  plotType   = "LINE"
                  legendTemplate = "p50"
                },
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"cloud_run_revision\" resource.label.service_name=\"api\" metric.type=\"run.googleapis.com/request_latencies\""
                      aggregation = {
                        alignmentPeriod    = "60s"
                        perSeriesAligner   = "ALIGN_DELTA"
                        crossSeriesReducer = "REDUCE_PERCENTILE_95"
                      }
                    }
                  }
                  plotType   = "LINE"
                  legendTemplate = "p95"
                },
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"cloud_run_revision\" resource.label.service_name=\"api\" metric.type=\"run.googleapis.com/request_latencies\""
                      aggregation = {
                        alignmentPeriod    = "60s"
                        perSeriesAligner   = "ALIGN_DELTA"
                        crossSeriesReducer = "REDUCE_PERCENTILE_99"
                      }
                    }
                  }
                  plotType   = "LINE"
                  legendTemplate = "p99"
                },
              ]
            }
          }
        },
        {
          yPos   = 4
          width  = 4
          height = 4
          widget = {
            title = "Image generations / 5m"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"logging.googleapis.com/user/image_generation_count\""
                    aggregation = {
                      alignmentPeriod  = "300s"
                      perSeriesAligner = "ALIGN_RATE"
                    }
                  }
                }
                plotType = "STACKED_BAR"
              }]
            }
          }
        },
        {
          xPos   = 4
          yPos   = 4
          width  = 4
          height = 4
          widget = {
            title = "Quota exceeded / 5m"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"logging.googleapis.com/user/quota_exceeded_count\""
                    aggregation = {
                      alignmentPeriod  = "300s"
                      perSeriesAligner = "ALIGN_RATE"
                    }
                  }
                }
                plotType = "STACKED_BAR"
              }]
            }
          }
        },
        {
          xPos   = 8
          yPos   = 4
          width  = 4
          height = 4
          widget = {
            title = "Checkout sessions / 5m"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"logging.googleapis.com/user/checkout_started_count\""
                    aggregation = {
                      alignmentPeriod  = "300s"
                      perSeriesAligner = "ALIGN_RATE"
                    }
                  }
                }
                plotType = "STACKED_BAR"
              }]
            }
          }
        },
        {
          yPos   = 8
          width  = 6
          height = 4
          widget = {
            title = "stripe-webhook requests by status"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type=\"cloud_run_revision\" resource.label.service_name=\"stripe-webhook\" metric.type=\"run.googleapis.com/request_count\""
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_RATE"
                      groupByFields      = ["metric.label.response_code_class"]
                      crossSeriesReducer = "REDUCE_SUM"
                    }
                  }
                }
                plotType = "STACKED_AREA"
              }]
            }
          }
        },
        {
          xPos   = 6
          yPos   = 8
          width  = 6
          height = 4
          widget = {
            title = "api container instance count"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type=\"cloud_run_revision\" resource.label.service_name=\"api\" metric.type=\"run.googleapis.com/container/instance_count\""
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_MEAN"
                      crossSeriesReducer = "REDUCE_SUM"
                    }
                  }
                }
                plotType = "LINE"
              }]
            }
          }
        },
      ]
    }
  })

  depends_on = [
    google_project_service.apis,
    google_logging_metric.image_generation_count,
    google_logging_metric.quota_exceeded_count,
    google_logging_metric.checkout_started_count,
  ]
}
