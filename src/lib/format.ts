import { TODAY } from "./data";
import { daysBetween, shortDate } from "./iso-date";

export { dayMonth, daysBetween, fullDate, shortDate, weekday } from "./iso-date";


/** Days from `today` (default: the sample story's day) to `iso`. Real pages pass IST today. */
export const daysFromToday = (iso: string, today: string = TODAY) => daysBetween(today, iso);

/** "Today", "Tomorrow", "Fri 3 Oct" */
export function relativeDay(iso: string) {
  const d = daysFromToday(iso);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  return shortDate(iso);
}

/** "2 days ago" style for last-practiced labels. */
export function ago(iso: string | null) {
  if (!iso) return "Not yet";
  const d = -daysFromToday(iso);
  if (d <= 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d} days ago`;
}

/** 1630 → "27:10" */
export const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** 160 → "2m 40s" */
export const duration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (!m) return `${s}s`;
  return s ? `${m}m ${s}s` : `${m}m`;
};

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
