import { isAppError, type ActionResult, type ErrorBody } from "./app-error";
import { messageFor } from "./messages";
import { logger } from "../observability/log";

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

/** Map anything thrown to the wire body. Unknown errors become `internal` and are logged. */
export function toErrorBody(e: unknown): ErrorBody {
  if (isAppError(e)) {
    return {
      code: e.code,
      message: e.message !== e.code ? e.message : messageFor(e.code),
      ...(e.fields ? { fields: e.fields } : {}),
      ...(e.retryAfter !== undefined ? { retryAfter: e.retryAfter } : {}),
    };
  }
  logger.error("unhandled", { err: e });
  return { code: "internal", message: messageFor("internal") };
}

export const fail = (e: unknown): ActionResult<never> => ({ ok: false, error: toErrorBody(e) });

/** Wrap a service call for a Server Action: `return run(() => service.doThing(...))`. */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    // Next control-flow errors (redirect, notFound) carry a digest and must keep propagating.
    if (e && typeof e === "object" && typeof (e as { digest?: unknown }).digest === "string") throw e;
    return fail(e);
  }
}
