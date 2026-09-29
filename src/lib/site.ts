/**
 * The marketing website (`web/`) is a separate deployment. Every link from the app to
 * a public page (policies, FAQ, contact) goes through `siteUrl` so the two can live on
 * different hosts, e.g. learnometry.in and app.learnometry.in.
 */
export const MARKETING_URL = (process.env.NEXT_PUBLIC_MARKETING_URL || "https://learnometry-ai.vercel.app").replace(/\/+$/, "");

export const siteUrl = (path = "/") => (path === "/" ? MARKETING_URL : `${MARKETING_URL}${path}`);

/** Support inbox — keep in step with `OFFICIAL_EMAIL` in the website (`web/src/lib/constants.ts`). */
export const SUPPORT_EMAIL = "learnometry.official@gmail.com";

/** The website promises this reply time on /contact; the app repeats it, never a shorter one. */
export const SUPPORT_REPLY = "We aim to reply within 24 business hours.";
