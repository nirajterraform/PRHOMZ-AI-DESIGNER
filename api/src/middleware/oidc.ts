import type { Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client();

/**
 * Verifies a Google-signed OIDC ID token in the Authorization header. Used for
 * endpoints called by Cloud Scheduler / Eventarc / Pub/Sub, where the caller
 * is a Google service account, not a Firebase end user.
 *
 * The expected audience is the Cloud Run service URL (e.g.
 * https://prhomz-api-abc123-uc.a.run.app). It's set via the
 * EXPECTED_OIDC_AUDIENCE env var, which Cloud Run TF wires from the service URL.
 *
 * If EXPECTED_AUDIENCE_OPTIONAL=true (local dev), audience is skipped and only
 * signature + Google issuer is verified.
 */
export async function requireOidc(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthenticated", message: "Missing Bearer token" });
    return;
  }
  const token = header.slice("Bearer ".length).trim();

  const expectedAudience = process.env.EXPECTED_OIDC_AUDIENCE;
  const audienceOptional = process.env.EXPECTED_AUDIENCE_OPTIONAL === "true";

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: audienceOptional ? undefined : expectedAudience,
    });
    const payload = ticket.getPayload();
    if (!payload) throw new Error("empty_payload");
    if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") {
      throw new Error(`unexpected_issuer: ${payload.iss}`);
    }
    next();
  } catch (e) {
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        event: "oidc_verify_failed",
        error: (e as Error).message,
      }),
    );
    res.status(401).json({ error: "unauthenticated", message: "Invalid OIDC token" });
  }
}
