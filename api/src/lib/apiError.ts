export type ApiErrorCode =
  | "unauthenticated"
  | "permission-denied"
  | "invalid-argument"
  | "failed-precondition"
  | "resource-exhausted"
  | "not-found"
  | "already-exists"
  | "internal"
  | "unavailable";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  "unauthenticated": 401,
  "permission-denied": 403,
  "invalid-argument": 400,
  "failed-precondition": 400,
  "resource-exhausted": 429,
  "not-found": 404,
  "already-exists": 409,
  "internal": 500,
  "unavailable": 503,
};

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.statusCode = STATUS_BY_CODE[code];
    this.details = details;
  }
}
