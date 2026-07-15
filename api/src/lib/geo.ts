import fs from "fs";
import path from "path";
import { Reader, ReaderModel, AddressNotFoundError } from "@maxmind/geoip2-node";
import type { Request } from "express";

// --- Config (env-driven so we can roll out / tune without a redeploy) ---

// Master switch. Default OFF so the feature ships dark and is flipped on only
// after we've confirmed the DB is in the image and detection works.
export const GEOFENCE_ENABLED = (process.env.GEOFENCE_ENABLED || "false").toLowerCase() === "true";

// ISO 3166-1 alpha-2 codes allowed to use Shop the Look. Amazon affiliate is
// US-only today, so the default is just "US".
export const ALLOWED_COUNTRIES = (process.env.GEOFENCE_ALLOWED_COUNTRIES || "US")
  .split(",")
  .map((c) => c.trim().toUpperCase())
  .filter(Boolean);

// Local-dev / testing override: force a detected country (e.g. "GB") without a
// real foreign IP. Ignored in the deployed container unless explicitly set.
const DEV_COUNTRY = (process.env.GEO_DEV_COUNTRY || "").trim().toUpperCase();

// The GeoLite2-Country DB is baked into the image at build time (see
// api/cloudbuild.yaml + Dockerfile). cwd is /app at runtime (CMD node lib/index.js).
const DB_PATH = process.env.GEODB_PATH || path.join(process.cwd(), "geodb", "GeoLite2-Country.mmdb");

// --- Reader singleton (fail-open if the DB is missing) ---

let reader: ReaderModel | null = null;
let readerLoaded = false;

function getReader(): ReaderModel | null {
  if (readerLoaded) return reader;
  readerLoaded = true;
  try {
    const buffer = fs.readFileSync(DB_PATH);
    reader = Reader.openBuffer(buffer);
    console.log(JSON.stringify({ severity: "INFO", event: "geodb_loaded", path: DB_PATH }));
  } catch (e) {
    // No DB in the image (or unreadable). We deliberately fail OPEN — a missing
    // DB must never hard-block legitimate US users. Logged loudly so it's caught.
    reader = null;
    console.error(
      JSON.stringify({
        severity: "ERROR",
        event: "geodb_load_failed",
        path: DB_PATH,
        error: (e as Error).message,
      }),
    );
  }
  return reader;
}

/**
 * Best-effort client IP. `trust proxy` is set to 1 in apiApp, so on Cloud Run
 * `req.ip` resolves to the caller's address (behind Google's front end).
 * NOTE: with direct Cloud Run ingress a client can inject X-Forwarded-For, so
 * this gate is best-effort (same category as VPN bypass). The spoof-proof
 * upgrade is the external load balancer + locked ingress.
 */
export function getClientIp(req: Request): string | null {
  const ip = req.ip || "";
  if (!ip) return null;
  // Normalise IPv4-mapped IPv6 (::ffff:1.2.3.4) that MaxMind also accepts, but
  // strip for cleaner logging.
  return ip.startsWith("::ffff:") ? ip.slice("::ffff:".length) : ip;
}

/** ISO country code for the request, or null if it can't be determined. */
export function detectCountry(req: Request): string | null {
  if (DEV_COUNTRY) return DEV_COUNTRY;

  const r = getReader();
  if (!r) return null;

  const ip = getClientIp(req);
  if (!ip) return null;

  try {
    const res = r.country(ip);
    return res.country?.isoCode?.toUpperCase() ?? null;
  } catch (e) {
    if (e instanceof AddressNotFoundError) return null; // private/unknown IP
    console.warn(
      JSON.stringify({ severity: "WARNING", event: "geo_lookup_failed", error: (e as Error).message }),
    );
    return null;
  }
}

export interface ShopRegionVerdict {
  country: string | null;
  shopEnabled: boolean;
}

/**
 * Decide whether the request may use Shop the Look.
 * - Feature disabled           → always allowed (dark launch).
 * - Country resolves           → allowed iff in ALLOWED_COUNTRIES.
 * - Country cannot be resolved → allowed (fail OPEN, so odd IPs / missing DB
 *   never block real US users). Bypass risk is acceptable for an affiliate gate.
 */
export function evaluateShopRegion(req: Request): ShopRegionVerdict {
  const country = detectCountry(req);
  if (!GEOFENCE_ENABLED) return { country, shopEnabled: true };
  if (!country) return { country, shopEnabled: true };
  return { country, shopEnabled: ALLOWED_COUNTRIES.includes(country) };
}
