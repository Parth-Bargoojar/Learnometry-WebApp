/*
  Runs once when the server boots. Validates the environment (a bad config fails at start,
  not on the first request) and starts Sentry — server side only, and only when SENTRY_DSN
  is set (BE-D48, BE-D67). No client SDK: the app's JS budget is 210 KB (§8.21a L11).
*/
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { getEnv } = await import("./lib/env");
  const env = getEnv();

  if (env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: 0.1,
      // Never ship personal or academic data (BE-D48).
      beforeSend(event) {
        if (event.request) {
          delete event.request.cookies;
          delete event.request.data;
          if (event.request.headers) {
            delete event.request.headers.cookie;
            delete event.request.headers.authorization;
          }
        }
        delete event.user;
        return event;
      },
    });
  }
}

export async function onRequestError(...args: unknown[]) {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  await (Sentry.captureRequestError as (...a: unknown[]) => Promise<void>)(...args);
}
