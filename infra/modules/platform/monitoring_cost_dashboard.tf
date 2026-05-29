# Cost-estimation dashboard. Multiplies live usage metrics by per-unit pricing
# constants to derive real-time $/hour rates and last-24h spend per service.
#
# Pricing constants (US-region public Google rates as of 2026). When Google
# updates pricing, edit the multipliers in the MQL queries below.
#
# - Gemini image gen (gemini-2.5-flash-image): $0.04 / image
# - Cloud Run requests:                         $0.40 / 1M = 0.0000004 / req
# - Cloud Run vCPU-seconds:                     $0.00002400 / vCPU-sec
# - Firestore document reads:                   $0.06 / 100K = 0.0000006 / read
#
# Live readings are ±20% vs. final Google billing because:
#   - Free tier discounts are not subtracted here
#   - Tax / committed-use discounts not applied
#   - Cloud Logging / Storage / Secret Manager omitted (small, noisy)
#
# Ground truth lives in BigQuery billing export -> Looker Studio (24h lag).

resource "google_monitoring_dashboard" "cost" {
  project = var.project_id

  dashboard_json = jsonencode({
    displayName  = "PRHOMZ — Cost (estimated, live)"
    mosaicLayout = {
      columns = 12
      tiles   = [

        # ─── Header ─────────────────────────────────────────────────────────
        {
          width  = 12
          height = 1
          widget = {
            text = {
              content = "## 💰 Live cost rate (current $/hour, by service)\nMultiplies live usage metrics by published per-unit rates. ±20% vs. actual GCP billing."
              format  = "MARKDOWN"
              style = {
                backgroundColor       = "#1A73E8"
                textColor             = "#FFFFFF"
                horizontalAlignment   = "H_LEFT"
                verticalAlignment     = "V_CENTER"
                padding               = "P_MEDIUM"
                fontSize              = "FS_LARGE"
              }
            }
          }
        },

        # ─── Row 1: $/hour rate scorecards ──────────────────────────────────
        {
          yPos   = 1
          width  = 3
          height = 3
          widget = {
            title = "Gemini image gen ($/hr)"
            scorecard = {
              timeSeriesQuery = {
                timeSeriesQueryLanguage = <<-MQL
                  fetch cloud_run_revision
                  | metric 'logging.googleapis.com/user/image_generation_count'
                  | align rate(1h)
                  | every 1m
                  | group_by [], [v: sum(value)]
                  | value [v * 0.04]
                MQL
                unitOverride = "USD"
              }
              sparkChartView = { sparkChartType = "SPARK_LINE" }
              thresholds = [
                { value = 1.0, color = "YELLOW", direction = "ABOVE" },
                { value = 5.0, color = "RED", direction = "ABOVE" },
              ]
            }
          }
        },
        {
          xPos   = 3
          yPos   = 1
          width  = 3
          height = 3
          widget = {
            title = "Cloud Run requests ($/hr)"
            scorecard = {
              timeSeriesQuery = {
                timeSeriesQueryLanguage = <<-MQL
                  fetch cloud_run_revision
                  | metric 'run.googleapis.com/request_count'
                  | align rate(1h)
                  | every 1m
                  | group_by [], [v: sum(value)]
                  | value [v * 0.0000004]
                MQL
                unitOverride = "USD"
              }
              sparkChartView = { sparkChartType = "SPARK_LINE" }
            }
          }
        },
        {
          xPos   = 6
          yPos   = 1
          width  = 3
          height = 3
          widget = {
            title = "Cloud Run vCPU ($/hr)"
            scorecard = {
              timeSeriesQuery = {
                timeSeriesQueryLanguage = <<-MQL
                  fetch cloud_run_revision
                  | metric 'run.googleapis.com/container/cpu/usage_time'
                  | align rate(1h)
                  | every 1m
                  | group_by [], [v: sum(value)]
                  | value [v * 0.0000240]
                MQL
                unitOverride = "USD"
              }
              sparkChartView = { sparkChartType = "SPARK_LINE" }
            }
          }
        },
        {
          xPos   = 9
          yPos   = 1
          width  = 3
          height = 3
          widget = {
            title = "Firestore reads ($/hr)"
            scorecard = {
              timeSeriesQuery = {
                timeSeriesQueryLanguage = <<-MQL
                  fetch firestore.googleapis.com/Database
                  | metric 'firestore.googleapis.com/document/read_count'
                  | align rate(1h)
                  | every 1m
                  | group_by [], [v: sum(value)]
                  | value [v * 0.0000006]
                MQL
                unitOverride = "USD"
              }
              sparkChartView = { sparkChartType = "SPARK_LINE" }
            }
          }
        },

        # ─── Header 2 ───────────────────────────────────────────────────────
        {
          yPos   = 4
          width  = 12
          height = 1
          widget = {
            text = {
              content = "## 📅 Spend in the last 24 hours"
              format  = "MARKDOWN"
              style = {
                backgroundColor     = "#34A853"
                textColor           = "#FFFFFF"
                horizontalAlignment = "H_LEFT"
                verticalAlignment   = "V_CENTER"
                padding             = "P_MEDIUM"
                fontSize            = "FS_LARGE"
              }
            }
          }
        },

        # ─── Row 2: last-24h scorecards ─────────────────────────────────────
        {
          yPos   = 5
          width  = 3
          height = 3
          widget = {
            title = "Gemini image gen (24h)"
            scorecard = {
              timeSeriesQuery = {
                timeSeriesQueryLanguage = <<-MQL
                  fetch cloud_run_revision
                  | metric 'logging.googleapis.com/user/image_generation_count'
                  | align delta(1d)
                  | every 1d
                  | group_by [], [v: sum(value)]
                  | value [v * 0.04]
                MQL
                unitOverride = "USD"
              }
            }
          }
        },
        {
          xPos   = 3
          yPos   = 5
          width  = 3
          height = 3
          widget = {
            title = "Cloud Run requests (24h)"
            scorecard = {
              timeSeriesQuery = {
                timeSeriesQueryLanguage = <<-MQL
                  fetch cloud_run_revision
                  | metric 'run.googleapis.com/request_count'
                  | align delta(1d)
                  | every 1d
                  | group_by [], [v: sum(value)]
                  | value [v * 0.0000004]
                MQL
                unitOverride = "USD"
              }
            }
          }
        },
        {
          xPos   = 6
          yPos   = 5
          width  = 3
          height = 3
          widget = {
            title = "Cloud Run vCPU (24h)"
            scorecard = {
              timeSeriesQuery = {
                timeSeriesQueryLanguage = <<-MQL
                  fetch cloud_run_revision
                  | metric 'run.googleapis.com/container/cpu/usage_time'
                  | align delta(1d)
                  | every 1d
                  | group_by [], [v: sum(value)]
                  | value [v * 0.0000240]
                MQL
                unitOverride = "USD"
              }
            }
          }
        },
        {
          xPos   = 9
          yPos   = 5
          width  = 3
          height = 3
          widget = {
            title = "Firestore reads (24h)"
            scorecard = {
              timeSeriesQuery = {
                timeSeriesQueryLanguage = <<-MQL
                  fetch firestore.googleapis.com/Database
                  | metric 'firestore.googleapis.com/document/read_count'
                  | align delta(1d)
                  | every 1d
                  | group_by [], [v: sum(value)]
                  | value [v * 0.0000006]
                MQL
                unitOverride = "USD"
              }
            }
          }
        },

        # ─── Header 3 ───────────────────────────────────────────────────────
        {
          yPos   = 8
          width  = 12
          height = 1
          widget = {
            text = {
              content = "## 📈 Cost rate over time"
              format  = "MARKDOWN"
              style = {
                backgroundColor     = "#FBBC04"
                textColor           = "#000000"
                horizontalAlignment = "H_LEFT"
                verticalAlignment   = "V_CENTER"
                padding             = "P_MEDIUM"
                fontSize            = "FS_LARGE"
              }
            }
          }
        },

        # ─── Row 3: time series, $/hour rate per service ────────────────────
        {
          yPos   = 9
          width  = 12
          height = 4
          widget = {
            title = "Estimated cost rate ($/hour), by service"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesQueryLanguage = <<-MQL
                      fetch cloud_run_revision
                      | metric 'logging.googleapis.com/user/image_generation_count'
                      | align rate(1h)
                      | every 5m
                      | group_by [], [v: sum(value)]
                      | value [v * 0.04]
                    MQL
                  }
                  plotType       = "STACKED_AREA"
                  legendTemplate = "Gemini image gen"
                },
                {
                  timeSeriesQuery = {
                    timeSeriesQueryLanguage = <<-MQL
                      fetch cloud_run_revision
                      | metric 'run.googleapis.com/container/cpu/usage_time'
                      | align rate(1h)
                      | every 5m
                      | group_by [], [v: sum(value)]
                      | value [v * 0.0000240]
                    MQL
                  }
                  plotType       = "STACKED_AREA"
                  legendTemplate = "Cloud Run vCPU"
                },
                {
                  timeSeriesQuery = {
                    timeSeriesQueryLanguage = <<-MQL
                      fetch cloud_run_revision
                      | metric 'run.googleapis.com/request_count'
                      | align rate(1h)
                      | every 5m
                      | group_by [], [v: sum(value)]
                      | value [v * 0.0000004]
                    MQL
                  }
                  plotType       = "STACKED_AREA"
                  legendTemplate = "Cloud Run requests"
                },
                {
                  timeSeriesQuery = {
                    timeSeriesQueryLanguage = <<-MQL
                      fetch firestore.googleapis.com/Database
                      | metric 'firestore.googleapis.com/document/read_count'
                      | align rate(1h)
                      | every 5m
                      | group_by [], [v: sum(value)]
                      | value [v * 0.0000006]
                    MQL
                  }
                  plotType       = "STACKED_AREA"
                  legendTemplate = "Firestore reads"
                },
              ]
              yAxis = {
                label = "$ / hour"
                scale = "LINEAR"
              }
            }
          }
        },

        # ─── Header 4 ───────────────────────────────────────────────────────
        {
          yPos   = 13
          width  = 12
          height = 1
          widget = {
            text = {
              content = "## 🔧 Usage drivers (what's actually being consumed)"
              format  = "MARKDOWN"
              style = {
                backgroundColor     = "#EA4335"
                textColor           = "#FFFFFF"
                horizontalAlignment = "H_LEFT"
                verticalAlignment   = "V_CENTER"
                padding             = "P_MEDIUM"
                fontSize            = "FS_LARGE"
              }
            }
          }
        },

        # ─── Row 4: usage drivers ───────────────────────────────────────────
        {
          yPos   = 14
          width  = 4
          height = 4
          widget = {
            title = "Image generations / hour"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"logging.googleapis.com/user/image_generation_count\""
                    aggregation = {
                      alignmentPeriod  = "3600s"
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
          yPos   = 14
          width  = 4
          height = 4
          widget = {
            title = "Cloud Run requests / min (by service)"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type=\"cloud_run_revision\" metric.type=\"run.googleapis.com/request_count\""
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_RATE"
                      groupByFields      = ["resource.label.service_name"]
                      crossSeriesReducer = "REDUCE_SUM"
                    }
                  }
                }
                plotType = "LINE"
              }]
            }
          }
        },
        {
          xPos   = 8
          yPos   = 14
          width  = 4
          height = 4
          widget = {
            title = "Container instance count"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type=\"cloud_run_revision\" metric.type=\"run.googleapis.com/container/instance_count\""
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_MEAN"
                      groupByFields      = ["resource.label.service_name"]
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
  ]
}

output "cost_dashboard_url" {
  description = "Direct URL to the cost-estimation monitoring dashboard."
  value       = "https://console.cloud.google.com/monitoring/dashboards/custom/${google_monitoring_dashboard.cost.id}?project=${var.project_id}"
}
