import express from "express";
import { handleStripeWebhook, WebhookError } from "./stripeWebhook";

const app = express();

app.set("trust proxy", 1);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "prhomz-stripe-webhook" });
});

// Stripe webhook receiver. express.raw is REQUIRED so the raw bytes survive
// for signature verification — express.json would have parsed and re-serialized
// them, producing a different byte sequence and breaking the HMAC check.
app.post(
  "/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  async (req, res) => {
    try {
      const signature = req.headers["stripe-signature"] as string | undefined;
      await handleStripeWebhook(req.body as Buffer | undefined, signature);
      res.status(200).json({ ok: true });
    } catch (err) {
      const status = err instanceof WebhookError ? err.statusCode : 500;
      console.error(
        JSON.stringify({
          severity: "ERROR",
          event: "stripe_webhook_failed",
          error: (err as Error).message,
          ...(err instanceof WebhookError ? {} : { stack: (err as Error).stack }),
        }),
      );
      res.status(status).json({ error: (err as Error).message || "handler_failed" });
    }
  },
);

app.use((_req, res) => {
  res.status(404).json({ error: "not_found" });
});

export default app;
