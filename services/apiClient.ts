import { auth } from "./firebaseClient";

const RAW_BASE = import.meta.env.VITE_API_BASE_URL;
if (!RAW_BASE) {
  throw new Error(
    "Missing VITE_API_BASE_URL. Set it in .env.local to your Cloud Run api service URL, e.g. https://api-XXXX-uc.a.run.app",
  );
}
export const API_BASE_URL: string = RAW_BASE.replace(/\/+$/, "");

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function getAuthHeader(forceRefresh = false): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new ApiClientError(401, "unauthenticated", "Sign in required.");
  const token = await user.getIdToken(forceRefresh);
  return `Bearer ${token}`;
}

interface PostResult {
  status: number;
  ok: boolean;
  statusText: string;
  parsed: unknown;
}

async function sendPost<TIn>(path: string, body: TIn, authHeader: string): Promise<PostResult> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });

  let parsed: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { error: "unparseable_response", message: text.slice(0, 200) };
    }
  }

  return { status: res.status, ok: res.ok, statusText: res.statusText, parsed };
}

export async function apiPost<TIn, TOut>(path: string, body: TIn): Promise<TOut> {
  let result = await sendPost(path, body, await getAuthHeader());

  // Self-heal for a freshly-verified user: their cached ID token may still
  // carry email_verified=false. On that specific rejection, force-refresh the
  // token once and retry so a verified user is never hard-blocked by staleness.
  if (result.status === 403 && (result.parsed as { error?: string } | null)?.error === "email_not_verified") {
    result = await sendPost(path, body, await getAuthHeader(true));
  }

  if (!result.ok) {
    const err = result.parsed as { error?: string; message?: string; details?: unknown } | null;
    throw new ApiClientError(
      result.status,
      err?.error || `http_${result.status}`,
      err?.message || result.statusText || "Request failed.",
      err?.details,
    );
  }

  return result.parsed as TOut;
}
