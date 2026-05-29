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

async function getAuthHeader(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new ApiClientError(401, "unauthenticated", "Sign in required.");
  const token = await user.getIdToken();
  return `Bearer ${token}`;
}

export async function apiPost<TIn, TOut>(path: string, body: TIn): Promise<TOut> {
  const authHeader = await getAuthHeader();
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

  if (!res.ok) {
    const err = parsed as { error?: string; message?: string; details?: unknown } | null;
    throw new ApiClientError(
      res.status,
      err?.error || `http_${res.status}`,
      err?.message || res.statusText || "Request failed.",
      err?.details,
    );
  }

  return parsed as TOut;
}
