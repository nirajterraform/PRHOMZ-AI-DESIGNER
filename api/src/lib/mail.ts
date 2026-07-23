/**
 * Minimal transactional-email sender via the SendGrid v3 REST API.
 *
 * Uses global `fetch` (Node 20) so there's no extra dependency. The API key is
 * read from `SENDGRID_API_KEY` (Secret Manager → Cloud Run env). If the key is
 * absent the send is skipped with a warning rather than throwing — callers
 * (e.g. the Stripe webhook) must never fail their main flow because email is
 * unavailable, or Stripe would retry the whole event.
 *
 * Sender identity: `MAIL_FROM` (defaults to noreply@prhomzai.com — the domain is
 * SPF/DKIM-authenticated in SendGrid, same as the auth emails).
 */
const SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send";
const FROM_NAME = "PRHOMZ AI";

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail({ to, subject, html, text }: MailInput): Promise<boolean> {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) {
    console.warn(
      JSON.stringify({ severity: "WARNING", event: "mail_skipped_no_key", subject }),
    );
    return false;
  }
  if (!to) {
    console.warn(JSON.stringify({ severity: "WARNING", event: "mail_skipped_no_recipient", subject }));
    return false;
  }

  const fromEmail = process.env.MAIL_FROM || "noreply@prhomzai.com";

  try {
    const res = await fetch(SENDGRID_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail, name: FROM_NAME },
        subject,
        // SendGrid requires content ordered by MIME type: text/plain first.
        content: [
          { type: "text/plain", value: text },
          { type: "text/html", value: html },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        JSON.stringify({
          severity: "ERROR",
          event: "mail_send_failed",
          status: res.status,
          subject,
          body: body.slice(0, 300),
        }),
      );
      return false;
    }

    console.log(JSON.stringify({ severity: "INFO", event: "mail_sent", subject }));
    return true;
  } catch (e) {
    console.error(
      JSON.stringify({
        severity: "ERROR",
        event: "mail_send_error",
        subject,
        error: (e as Error).message,
      }),
    );
    return false;
  }
}
