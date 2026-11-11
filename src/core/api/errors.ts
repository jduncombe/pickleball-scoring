/** An error response from the API, or a failure to reach it. */
export class ApiError extends Error {
  /** HTTP status, or 0 when the request never got a response (offline, timeout). */
  readonly status: number;
  /** Fields the API blamed, e.g. ["score_a"] for a 422 score error. */
  readonly fields: string[];

  constructor(status: number, message: string, fields: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }

  /** The request didn't reach the API, so it's safe to retry later. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }
}

interface ValidationItem {
  loc?: (string | number)[];
  msg?: string;
}

/**
 * A readable message from a FastAPI error body: `{"detail": "..."}` or
 * `{"detail": [{"loc": [...], "msg": "..."}]}`.
 */
export function parseErrorBody(status: number, body: unknown): ApiError {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return new ApiError(status, detail);
  if (Array.isArray(detail)) {
    const items = detail as ValidationItem[];
    const messages = [...new Set(items.map((d) => d.msg).filter((m): m is string => !!m))];
    const fields = items
      .map((d) => d.loc?.[d.loc.length - 1])
      .filter((f): f is string => typeof f === "string");
    return new ApiError(status, messages.join("\n") || `Request failed (${status})`, fields);
  }
  return new ApiError(status, defaultMessage(status));
}

function defaultMessage(status: number): string {
  switch (status) {
    case 401:
      return "Your session has expired; sign in again";
    case 404:
      return "Not found";
    case 429:
      return "Too many attempts; wait a minute and try again";
    default:
      return status >= 500 ? "The server had a problem; try again" : `Request failed (${status})`;
  }
}
