/*
  Error model (BE-D13). Services throw `AppError`; actions return `ActionResult`; routes
  return the same body with the HTTP status. The code list is closed: extend it in
  DECISIONS.md first.
*/
export const ERROR_STATUS = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  consent_required: 403,
  validation_failed: 422,
  insufficient_credits: 402,
  rate_limited: 429,
  concurrency_limit: 409,
  conflict: 409,
  idempotent_replay: 200,
  attempt_closed: 409,
  breaker_restricted: 503,
  feature_disabled: 403,
  payment_provider_error: 502,
  ai_unavailable: 503,
  internal: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  fields?: Record<string, string>;
  retryAfter?: number;
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ErrorBody };

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;
  readonly retryAfter?: number;

  constructor(
    code: ErrorCode,
    opts: { message?: string; fields?: Record<string, string>; retryAfter?: number; cause?: unknown } = {},
  ) {
    super(opts.message ?? code, { cause: opts.cause });
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.fields = opts.fields;
    this.retryAfter = opts.retryAfter;
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;
