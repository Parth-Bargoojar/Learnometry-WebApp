/**
 * The marketing website (`web/`) is a separate deployment. Every link from the app to
 * a public page (policies, FAQ, contact) goes through `siteUrl` so the two can live on
 * different hosts, e.g. learnometry.in and app.learnometry.in.
 */
export const MARKETING_URL = (process.env.NEXT_PUBLIC_MARKETING_URL || "https://learnometry-ai.vercel.app").replace(/\/+$/, "");

export const siteUrl = (path = "/") => (path === "/" ? MARKETING_URL : `${MARKETING_URL}${path}`);
