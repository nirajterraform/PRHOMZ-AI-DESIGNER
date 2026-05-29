import * as admin from "firebase-admin";
import StripeSDK from "stripe";
import type { UserTier } from "./_shared/tiers";
import { recomputeExpiry } from "./lib/recomputeExpiry";
import { getTierFromPriceId, USE_MOCK_STRIPE } from "./_shared/pricing";

interface StripeSubscriptionShape {
  id: string;
  metadata?: Record<string, string>;
  customer: string | { id: string };
  items: { data: Array<{ price: { id: string }; current_period_end?: number }> };
  cancel_at_period_end?: boolean;
  status: string;
  current_period_end?: number;
}

interface StripeInvoiceShape {
  id?: string;
  customer: string | { id: string } | null;
}

class WebhookError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

/**
 * Entry point for the webhook Express app. Receives the raw body and signature
 * header; dispatches to either the mock or real-Stripe handler.
 */
export async function handleStripeWebhook(
  rawBody: Buffer | undefined,
  signature: string | undefined,
): Promise<void> {
  const isRealStripe = !!signature && !USE_MOCK_STRIPE;

  if (isRealStripe) {
    if (!rawBody) throw new WebhookError(400, "missing_body");
    await handleRealStripeEvent(rawBody, signature!);
    return;
  }

  let parsed: unknown;
  try {
    parsed = rawBody && rawBody.length > 0 ? JSON.parse(rawBody.toString("utf8")) : {};
  } catch {
    throw new WebhookError(400, "invalid_json");
  }
  await handleMockEvent(parsed as MockEvent);
}

// ---------- Mock mode ----------

type MockEvent =
  | {
      type: "customer.subscription.created";
      data: {
        uid: string;
        tier: Exclude<UserTier, "freemium">;
        subscriptionId: string;
        currentPeriodEnd: number;
      };
    }
  | {
      type: "customer.subscription.updated";
      data: {
        uid: string;
        tier: Exclude<UserTier, "freemium">;
        subscriptionId: string;
        currentPeriodEnd: number;
        cancelAtPeriodEnd?: boolean;
      };
    }
  | {
      type: "customer.subscription.deleted";
      data: { uid: string; subscriptionId: string };
    }
  | {
      type: "invoice.payment_failed";
      data: { uid: string; subscriptionId: string };
    };

async function handleMockEvent(event: MockEvent): Promise<void> {
  if (!event?.type || !event?.data?.uid) {
    throw new WebhookError(400, "missing_event_fields");
  }

  switch (event.type) {
    case "customer.subscription.created":
      await applyTierChange(event.data.uid, {
        tier: event.data.tier,
        subscriptionId: event.data.subscriptionId,
        subscriptionStatus: "active",
        currentPeriodEnd: event.data.currentPeriodEnd,
      });
      return;
    case "customer.subscription.updated":
      await applyTierChange(event.data.uid, {
        tier: event.data.tier,
        subscriptionId: event.data.subscriptionId,
        subscriptionStatus: event.data.cancelAtPeriodEnd ? "canceled" : "active",
        currentPeriodEnd: event.data.currentPeriodEnd,
      });
      return;
    case "customer.subscription.deleted":
      await applyTierChange(event.data.uid, {
        tier: "freemium",
        subscriptionId: null,
        subscriptionStatus: null,
        currentPeriodEnd: null,
      });
      return;
    case "invoice.payment_failed":
      await markPastDue(event.data.uid);
      return;
  }
}

// ---------- Real Stripe mode ----------

async function handleRealStripeEvent(rawBody: Buffer, signature: string): Promise<void> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey) throw new WebhookError(500, "STRIPE_SECRET_KEY not configured");
  if (!webhookSecret) throw new WebhookError(500, "STRIPE_WEBHOOK_SECRET not configured");

  const stripe = new StripeSDK(stripeKey);
  let event: { type: string; id: string; data: { object: unknown } };
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    ) as unknown as typeof event;
  } catch (e) {
    throw new WebhookError(
      401,
      `Webhook signature verification failed: ${(e as Error).message}`,
    );
  }

  console.log(
    JSON.stringify({ severity: "INFO", event: "stripe_event_received", type: event.type, id: event.id }),
  );

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as StripeSubscriptionShape;
      const uid = await resolveUidFromStripe(sub);
      if (!uid) {
        console.warn(
          JSON.stringify({ severity: "WARNING", event: "uid_unresolved", subscriptionId: sub.id }),
        );
        return;
      }

      const item = sub.items.data[0];
      const tier = item ? getTierFromPriceId(item.price.id) : null;
      if (!tier) {
        console.warn(
          JSON.stringify({
            severity: "WARNING",
            event: "tier_unmatched",
            subscriptionId: sub.id,
            priceId: item?.price.id,
          }),
        );
        return;
      }

      const cancelAtPeriodEnd = sub.cancel_at_period_end === true;
      const status: "active" | "past_due" | "canceled" = cancelAtPeriodEnd
        ? "canceled"
        : sub.status === "past_due" || sub.status === "unpaid"
          ? "past_due"
          : "active";

      const periodEndSec = item?.current_period_end ?? sub.current_period_end ?? 0;

      await applyTierChange(uid, {
        tier,
        subscriptionId: sub.id,
        subscriptionStatus: status,
        currentPeriodEnd: periodEndSec ? periodEndSec * 1000 : null,
      });
      return;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as StripeSubscriptionShape;
      const uid = await resolveUidFromStripe(sub);
      if (!uid) {
        console.warn(
          JSON.stringify({
            severity: "WARNING",
            event: "uid_unresolved_on_delete",
            subscriptionId: sub.id,
          }),
        );
        return;
      }
      await applyTierChange(uid, {
        tier: "freemium",
        subscriptionId: null,
        subscriptionStatus: null,
        currentPeriodEnd: null,
      });
      return;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as StripeInvoiceShape;
      const uid = await resolveUidFromInvoice(invoice);
      if (!uid) {
        console.warn(
          JSON.stringify({
            severity: "WARNING",
            event: "uid_unresolved_on_invoice",
            invoiceId: invoice.id ?? "(unknown)",
          }),
        );
        return;
      }
      await markPastDue(uid);
      return;
    }

    default:
      console.log(
        JSON.stringify({ severity: "INFO", event: "stripe_event_unhandled", type: event.type }),
      );
      return;
  }
}

async function resolveUidFromStripe(sub: StripeSubscriptionShape): Promise<string | null> {
  const fromMeta = sub.metadata?.firebaseUid;
  if (fromMeta) return fromMeta;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return null;
  return resolveUidFromCustomerId(customerId);
}

async function resolveUidFromInvoice(invoice: StripeInvoiceShape): Promise<string | null> {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return null;
  return resolveUidFromCustomerId(customerId);
}

async function resolveUidFromCustomerId(customerId: string): Promise<string | null> {
  const q = await admin
    .firestore()
    .collection("users")
    .where("stripeCustomerId", "==", customerId)
    .limit(1)
    .get();
  return q.empty ? null : q.docs[0].id;
}

interface TierUpdate {
  tier: UserTier;
  subscriptionId: string | null;
  subscriptionStatus: "active" | "past_due" | "canceled" | null;
  currentPeriodEnd: number | null;
}

async function applyTierChange(uid: string, update: TierUpdate): Promise<void> {
  const userRef = admin.firestore().doc(`users/${uid}`);
  await userRef.update({
    tier: update.tier,
    subscriptionId: update.subscriptionId,
    subscriptionStatus: update.subscriptionStatus,
    currentPeriodEnd: update.currentPeriodEnd,
    lastActive: Date.now(),
  });
  const count = await recomputeExpiry(uid, update.tier);
  console.log(
    JSON.stringify({
      severity: "INFO",
      event: "tier_changed",
      uid,
      tier: update.tier,
      status: update.subscriptionStatus,
      galleryDocsUpdated: count,
    }),
  );
}

async function markPastDue(uid: string): Promise<void> {
  await admin.firestore().doc(`users/${uid}`).update({
    subscriptionStatus: "past_due",
    lastActive: Date.now(),
  });
  console.log(
    JSON.stringify({ severity: "INFO", event: "marked_past_due", uid }),
  );
}

export { WebhookError };
