import type { ErrorCode } from "./app-error";

/*
  The one place learner-facing error copy lives (BE-D13). Voice: Web App Structure §12 —
  say what happened, say what to do, no blame, no jargon, no exclamation marks.
*/
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  unauthenticated: "Please sign in to continue.",
  forbidden: "You don't have access to this.",
  not_found: "We couldn't find that.",
  consent_required: "A parent or guardian needs to approve your account before you can do this.",
  validation_failed: "Some details need another look.",
  insufficient_credits: "You need more credits for this.",
  rate_limited: "That was a few too many tries. Please wait a moment and try again.",
  concurrency_limit: "Another request is still running. Please wait for it to finish.",
  conflict: "That changed while you were working. Refresh and try again.",
  idempotent_replay: "Already done.",
  attempt_closed: "This test has ended, so answers can't be changed.",
  breaker_restricted: "This feature is paused for a short while. Please try again later.",
  feature_disabled: "This isn't available right now.",
  payment_provider_error: "We couldn't reach the payment service. You haven't been charged. Please try again.",
  ai_unavailable: "The explanation engine is busy. Please try again in a moment.",
  internal: "Something went wrong on our side. Please try again.",
};

export const messageFor = (code: ErrorCode) => ERROR_MESSAGES[code];
