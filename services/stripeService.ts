import { apiPost } from "./apiClient";
import type { UserTier } from "../types";

interface SessionResponse {
  url: string;
  mock?: boolean;
}

export async function createCheckoutSession(
  tier: Exclude<UserTier, "freemium">,
  returnUrl: string = window.location.origin,
): Promise<string> {
  const result = await apiPost<
    { tier: Exclude<UserTier, "freemium">; returnUrl: string },
    SessionResponse
  >("/proxyCreateCheckoutSession", { tier, returnUrl });
  return result.url;
}

export async function createCustomerPortalSession(
  returnUrl: string = window.location.origin,
): Promise<string> {
  const result = await apiPost<{ returnUrl: string }, SessionResponse>(
    "/proxyCreateCustomerPortalSession",
    { returnUrl },
  );
  return result.url;
}

/**
 * Mock-mode helper: POSTs a synthetic event body to the stripe-webhook Cloud Run
 * service. Used only by MockCheckout / MockPortal when USE_MOCK_STRIPE is true.
 * In real Stripe mode this path is closed — Stripe posts directly with a
 * verified signature.
 *
 * Target URL is the stripe-webhook Cloud Run service. Configure via
 * VITE_STRIPE_WEBHOOK_URL or fall back to the api base + "-webhook" pattern is
 * unreliable; require explicit env var.
 */
export async function fireMockWebhookEvent(event: {
  type: string;
  data: Record<string, unknown>;
}): Promise<void> {
  const url = import.meta.env.VITE_STRIPE_WEBHOOK_URL;
  if (!url) {
    throw new Error(
      "Missing VITE_STRIPE_WEBHOOK_URL. Set it in .env.local to your stripe-webhook Cloud Run URL + /webhook.",
    );
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mock webhook failed (${res.status}): ${text}`);
  }
}
