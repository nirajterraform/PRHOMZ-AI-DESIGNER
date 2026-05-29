import type { Request, Response, NextFunction } from "express";
import * as admin from "firebase-admin";

export interface AuthedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    email_verified: boolean;
  };
}

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthenticated", message: "Missing Bearer token" });
    return;
  }
  const token = header.slice("Bearer ".length).trim();
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      email_verified: decoded.email_verified ?? false,
    };
    next();
  } catch (e) {
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        message: "Invalid ID token",
        error: (e as Error).message,
      }),
    );
    res.status(401).json({ error: "unauthenticated", message: "Invalid ID token" });
  }
}

export function requireVerifiedEmail(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  if (!req.user.email_verified) {
    res.status(403).json({ error: "email_not_verified", message: "Verify your email before continuing." });
    return;
  }
  next();
}
