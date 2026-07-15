// OpenTelemetry -> Cloud Trace bootstrap.
//
// MUST be imported before any instrumented library (express, http, firestore,
// grpc) so the auto-instrumentation require-hooks can patch them — hence it is
// the very first import in index.ts.
//
// Only active on Cloud Run (K_SERVICE is set there); a no-op locally so dev
// doesn't emit spans or need trace credentials. No env flag needed — the
// cloudtrace.agent role + API are already provisioned for the runtime SA.
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { TraceExporter } from "@google-cloud/opentelemetry-cloud-trace-exporter";

if (process.env.K_SERVICE) {
  try {
    const sdk = new NodeSDK({
      traceExporter: new TraceExporter(),
      instrumentations: [
        getNodeAutoInstrumentations({
          // fs spans are extremely noisy and low value — disable them.
          "@opentelemetry/instrumentation-fs": { enabled: false },
        }),
      ],
    });

    sdk.start();
    console.log(
      JSON.stringify({ severity: "INFO", event: "otel_tracing_started", service: process.env.K_SERVICE }),
    );

    // Flush buffered spans when Cloud Run sends SIGTERM before shutdown.
    process.on("SIGTERM", () => {
      sdk.shutdown().catch(() => {
        /* best-effort flush; ignore errors during shutdown */
      });
    });
  } catch (e) {
    // Never let tracing setup crash the service.
    console.error(
      JSON.stringify({ severity: "ERROR", event: "otel_tracing_start_failed", error: (e as Error).message }),
    );
  }
}
