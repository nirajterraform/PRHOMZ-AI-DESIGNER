import { sendEmail } from "./mail";
import { TIER_DISPLAY } from "../_shared/pricing";
import type { UserTier } from "../_shared/tiers";

/**
 * Branded "subscription cancelled" confirmation email.
 *
 * Stripe has no built-in cancellation email, so we send our own when a user
 * cancels (subscription flips to cancel-at-period-end). The message confirms
 * the cancellation and states the date until which paid access continues,
 * after which the account reverts to Freemium.
 */
function buildCancellationEmail(
  firstName: string,
  tier: UserTier,
  accessUntilMs: number | null,
): { subject: string; html: string; text: string } {
  const planName = TIER_DISPLAY[tier]?.name ?? "your plan";
  const accessUntil =
    accessUntilMs && accessUntilMs > 0
      ? new Intl.DateTimeFormat("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        }).format(new Date(accessUntilMs))
      : null;

  const untilLine = accessUntil
    ? `You'll keep full <strong>${planName}</strong> access until <strong>${accessUntil}</strong>. After that your account moves to the free Freemium tier — no further charges.`
    : `Your <strong>${planName}</strong> access will end at the close of your current billing period. After that your account moves to the free Freemium tier — no further charges.`;

  const untilText = accessUntil
    ? `You'll keep full ${planName} access until ${accessUntil}. After that your account moves to the free Freemium tier — no further charges.`
    : `Your ${planName} access will end at the close of your current billing period. After that your account moves to the free Freemium tier — no further charges.`;

  const subject = "Your PRHOMZ AI subscription has been cancelled";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0b0f17;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0f17;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#111726;border:1px solid #1f2937;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:32px 40px 8px;">
                <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">PRHOMZ <span style="color:#8ab4f6;">AI</span></div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 40px 24px;">
                <h1 style="margin:16px 0 12px;font-size:20px;color:#ffffff;">Cancellation confirmed</h1>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#c7cfdb;">Hi ${firstName},</p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#c7cfdb;">We're confirming that your PRHOMZ AI subscription has been cancelled. ${untilLine}</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#c7cfdb;">Changed your mind? You can re-subscribe anytime from your account — your gallery and settings stay put.</p>
                <a href="https://designer.prhomzai.com" style="display:inline-block;background:#8ab4f6;color:#0b0f17;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px;">Open PRHOMZ AI</a>
                <p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#7c8598;">Questions? Reach us at support@prhomz.com.</p>
              </td>
            </tr>
          </table>
          <p style="margin:20px 0 0;font-size:11px;color:#5b6472;">PRHOMZ Inc • You received this because a subscription change was made on your account.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `Cancellation confirmed

Hi ${firstName},

We're confirming that your PRHOMZ AI subscription has been cancelled. ${untilText}

Changed your mind? You can re-subscribe anytime from your account — your gallery and settings stay put.

Open PRHOMZ AI: https://designer.prhomzai.com

Questions? Reach us at support@prhomz.com.

PRHOMZ Inc`;

  return { subject, html, text };
}

/**
 * Sends the cancellation-confirmation email. Never throws — returns false on
 * any problem so the caller's main flow is unaffected.
 */
export async function sendCancellationEmail(
  email: string | undefined,
  firstName: string | undefined,
  tier: UserTier,
  accessUntilMs: number | null,
): Promise<boolean> {
  if (!email) return false;
  const { subject, html, text } = buildCancellationEmail(firstName?.trim() || "there", tier, accessUntilMs);
  return sendEmail({ to: email, subject, html, text });
}
