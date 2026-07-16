import * as Sentry from "@sentry/react";

/**
 * Frontend error tracking (7.6). Initialises only when VITE_SENTRY_DSN is set,
 * so the app runs untouched until a Sentry project DSN is provided (and locally
 * in dev where the env var is absent). The DSN is a public client value by
 * design — safe to embed in the bundle.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || "production",
    // Release tag (optional) — set VITE_APP_VERSION at build time to group by deploy.
    release: import.meta.env.VITE_APP_VERSION || undefined,
    integrations: [
      Sentry.browserTracingIntegration(),
      // Capture a session replay only when an error occurs (cheap, great for repro).
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    // Performance tracing — sample lightly to stay well within the free tier.
    tracesSampleRate: 0.1,
    // No replay on normal sessions; full replay on the sessions that error.
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
    // Don't send noisy expected errors (auth prompts, aborted fetches).
    ignoreErrors: ["AbortError", "Non-Error promise rejection captured"],
  });
}
