import type { Response, NextFunction } from "express";
import type { AuthedRequest } from "./auth";
import { evaluateShopRegion } from "../lib/geo";

/**
 * Blocks Shop the Look endpoints for requests outside the allowed region.
 * Authoritative server-side gate — the frontend also hides the button, but this
 * is what actually enforces it. Fails open when the country is unknown.
 */
export function requireShopRegion(req: AuthedRequest, res: Response, next: NextFunction): void {
  const { shopEnabled } = evaluateShopRegion(req);
  if (!shopEnabled) {
    res.status(403).json({
      error: "region_not_supported",
      message: "Shop the Look is currently available in the United States only.",
    });
    return;
  }
  next();
}
